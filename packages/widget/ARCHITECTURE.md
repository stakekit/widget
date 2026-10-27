# Widget Architecture

This document records stable ownership and dependency boundaries. Behavior,
route topology, failure presentation, and detailed workflows belong in code and
tests. Executable policy lives in Biome, dependency-cruiser, Knip, jscpd, and
ast-grep.

## Ownership

`packages/widget/src` is organized by the owner of a capability:

```text
app/          application composition, routing, and runtime assembly
features/     user-facing capabilities and their state
resources/    authoritative cacheable remote reads
services/     side effects and external-system adapters
domain/       framework-independent rules and models
shared/       neutral utilities and UI primitives
public-api/   host-facing types
```

Code stays private to its owner unless another owner needs a deliberate
interface. Shared is for neutral building blocks, not displaced feature logic.
Shared may depend on Domain types and rules, but not on features, resources, or
services. The application composes Modules; it does not absorb their behavior.

Activity owns the activity feed, action lookup, action details, and their
variant layouts. A Yield Action Continuation starts from Activity but runs as a
Yield Transaction Flow; completed and failed details never start one.

## Dependency direction

Dependencies point toward narrow interfaces and stable lower-level concepts:

```text
outbound package entries
          |
          v
application composition
          |
          v
feature interfaces and resource interfaces
          |
          v
owned implementations -> domain rules / services / shared primitives
```

Imports within an owner may target its implementation. Imports across owners
use that owner's declared interface. Generated API clients and transport details
remain private to `services/api`.

`public-api` may import Domain only through `domain/**/contract.ts`. Domain never
imports `public-api`. A Domain contract may publish selected stable types and
runtime values, while schemas, decoders, catalogues, and other implementation
files stay private.

`src/index.package.ts` and `src/index.bundle.ts` are outbound-only package
entries. Nothing under `src` imports them.

## Public API

Public types are a semver contract with host applications, not the
application's model. They are hand-written in `public-api`, never aliased from
generated API clients or internal implementation types, so a backend or
refactoring change cannot silently alter what hosts compile against. The only
derived exceptions are stable Domain contract re-exports and the theme token
contract, which `public-api` owns.

Every hand-written public type has a compile-time conformance site where an
internal value crosses into or out of it: internal producers assign into the
public type before handing it to a host callback, and host inputs are decoded at
the configuration boundary with exhaustive literal lists. A new public type
without such a site is incomplete.

Host-facing types are imported only at host boundaries: raw Host Configuration
composition and decoding in `services/config`, and the host wallet and tracking
adapters. Every other Module uses Domain or owner types, so internal rules never
depend on the shape hosts see. dependency-cruiser enforces this.

`src/index.package.ts` and `src/index.bundle.ts` are both the runtime entries
and the published declarations. Every exported value is annotated with a
`public-api` type, and `build:types` transpiles each entry alone under
`isolatedDeclarations`, so implementation types never reach hosts and `tsc`
checks each implementation against its published signature. Every named type
that appears in an entry's public signatures is exported by name from that
entry.

## Module interfaces

An Owned Module publishes only the finite interfaces its actual consumers need,
as recorded in [ADR 0007](../../docs/adr/0007-owned-modules-expose-finite-interfaces.md).
Files not named below are private even when they sit at a Module root.

A Feature Module may publish:

- `index.ts` for headless models, commands, Atoms, types, and zero-logic adapter
  hooks.
- `composition.ts` for screens, routes, layouts, providers, guards, and mounts.
- `views.ts` for rendered elements intentionally reused outside the Feature.
- `runtime.ts` for operations used in runtime assembly.

Create only the entries with consumers. Internal code normally lives under
`model/`, `state/`, `react/`, and `ui/`. `state/` is organized by page: a page
module holds its page's Atom family and the Effect functions only that page
runs; what several pages share, such as starting or leaving a flow, lives in a
module of its own. An operation a runtime service also runs does not import the
application runtime, since that import would cycle.

Each immediate child of `resources/` is a Resource Module and publishes
`index.ts`. A nested Module Collection consumes child interfaces and publishes
its own facade instead of re-exporting child internals.

`services/api` is one owned Module with purpose-specific interfaces:

- `resource-sources.ts` for Resources.
- `operations.ts` for feature orchestration and transaction internals.
- `runtime.ts` for application runtime assembly.

It has no `index.ts`. Transport, generated clients, and capability
implementations remain private.

Interface exports are explicit and named. Wildcard exports and convenience
barrels are not interfaces. Tests may deep-import private machinery when the
test is intentionally about that machinery.

## Application logic

Plain TypeScript owns deterministic domain state, transitions, invariants, and
projections. Effect owns side effects, concurrency, retry, and rollback. Effect
Atom owns reactive composition, including page view models, and the adapter
between Effect and rendering. React renders published state and dispatches
semantic commands. See
[ADR 0002](../../docs/adr/0002-effect-and-effect-atom-own-application-logic.md).

Effect work is expressed as operations: Effect functions whose services come
from the runtime that runs them, or that resolve them once when a runtime
service builds on them during Layer construction. Operations do not accept
Atoms, registries, or Atom contexts.

Context services live in `services/`; Features do not define them. A Feature
keeps its own state in Atoms: writable Atoms in the page's family for page
state, and `Atom.keepAlive` Atoms for state that outlives a page. State that
describes an external system, or that code outside React reads or writes, is a
service in `services/`, which Features project into Atoms.

A page's view model is a set of Atoms from an `Atom.family`, keyed by data every
render of the page shares (a Session, a history entry, a handoff). React may
discard a render after it read an Atom, so Atoms are never created per render or
per mount. Effect Atoms own the page's work, so it ends when the page stops
showing it; derived Atoms project its view. Command Atoms are deliberately
shallow: a command reads a snapshot, decides through a pure function, and
performs one state transition or delegates to one Effect operation. Multi-step
side effects, such as a handoff with its navigation, belong in that operation.

## Resources and state

Each canonical remote fact has one authoritative Resource. The Resource owns
request identity, caching, freshness, pagination, retry, invalidation, loading,
typed failure, and stale-result suppression. Features consume and project that
state rather than creating parallel caches. See
[ADR 0003](../../docs/adr/0003-authoritative-resources-own-shared-remote-reads.md).

Each workflow fact has one authoritative writer. Atom may project Effect-owned
state but does not maintain a second writable copy or invent a lifecycle state
before its scoped source exists. Local synchronous presentation state such as
focus, hover, disclosure, and DOM refs may remain in React.

Resource and workflow retention is an explicit ownership decision: an effect
Atom's work lives while something subscribes to it, directly or through an Atom
that reads it. Features do not mount Atoms through the registry; a value that
must keep a scoped handle open without reading it uses the shared
application-runtime adapter (`makeScopedEffectAtom`).

Relevance is a lifetime, not a counter. A page, modal opening, or attempt owns
a `Scope`; ending it closes the Scope and interrupts its work.
Do not guard continuation with revision, epoch, or `isCurrent` checks. A
lifetime consumed by a React subtree is owned by the Atoms that subtree
subscribes to, not by a service-held "current" slot. See
[ADR 0011](../../docs/adr/0011-lifetimes-are-scopes-staleness-is-interruption.md).

## Trust boundaries

The Module that owns a value-shaped input boundary owns its Effect Schema and
decoder. Unknown values, serialized data, persisted data, URL data, and callback
results are decoded before their fields affect application state or behavior.
The boundary contract decides whether to reject, recover from, or discard an
invalid input.

Opaque capabilities such as functions, DOM nodes, and SDK instances cross
through explicit typed adapters rather than shape inspection. Property probes,
casts, and handwritten type predicates do not promote untrusted values into
domain types. Ordinary narrowing of an already-decoded or internal
discriminated union remains allowed. See
[ADR 0009](../../docs/adr/0009-effect-schema-owns-value-shaped-boundary-decoding.md).

## Runtime and lifecycle

One Application Runtime Generation is created per Widget Instance. The current
Widget Configuration remains live within it, while Wallet Topology is captured
at Wallet Bootstrap and remains fixed. See
[ADR 0004](../../docs/adr/0004-widget-configuration-is-live-wallet-topology-is-fixed.md).

React composition seeds application initialization values, not Effect Layers.
Application-owned Atom runtimes compose through their `layer` Atoms. Production
runtimes install their default adapters, and tests replace the narrowest runtime
Layer relevant to the behavior through Atom registry initial values. Runtime
composition preserves registry-scoped Layer memoization; do not reconstruct
Layers from built Effect contexts or use `Layer.fresh` without an explicit need
for separate service instances.

The Widget is designed and tested for one mounted Widget Instance per browser
document, though runtime claims no longer block concurrent mounts. Unmounting and
later mounting a new instance creates a fresh generation. See
[ADR 0001](../../docs/adr/0001-one-widget-instance-per-browser-document.md).

React Context is limited to real render-tree concerns and third-party provider
boundaries. Application services and cross-feature state use the Effect runtime
and Effect Atom registry.

## Enforcement

- dependency-cruiser enforces cross-Module direction, keeps API internals
  private, keeps the `internal/` folders of `services/wallet` and
  `services/transaction-workflow` private to their service, and keeps API
  transport free of error presentation.
- Biome constrains barrels and keeps React out of domain, Resource, and service
  logic and out of Feature `model/` and `state/`.
- ast-grep rejects manual memoization (`useMemo`, `useCallback`, `memo`; React
  Compiler memoizes, and only functions with a `"use no memo"` directive may
  memoize by hand), ad hoc Atom runtimes, direct Effect runtime execution,
  native `Date`, global `fetch`, throws in Effect generators, wildcard Module
  exports, and Resources that read an API ResourceSource without
  `makePresentableResource`.
- Architecture rules live in these tools, not in tests that read source text.
- Knip checks ordinary and production reachability.
- jscpd fails when duplicated source and tooling code (tests and generated API
  clients excluded) exceeds 1% of lines.

Run `mise exec -- pnpm check-hygiene` after changing the module graph. Change
the implementation or the exact policy when the design changes; do not silence
the checks broadly.
