# Widget Architecture

This document records stable ownership and dependency boundaries. Behavior,
route topology, failure presentation, and detailed workflows belong in code and
tests. Executable policy lives in Biome, dependency-cruiser, Knip, and ast-grep.

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
The application composes Modules; it does not absorb their behavior.

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

## Module interfaces

An Owned Module publishes only the finite interfaces its actual consumers need,
as recorded in [ADR 0007](../../docs/adr/0007-owned-modules-expose-finite-interfaces.md).
Files not named below are private even when they sit at a Module root.

A Feature Module may publish:

- `index.ts` for headless models, commands, Atoms, types, and zero-logic adapter
  hooks.
- `composition.ts` for screens, routes, layouts, providers, guards, and mounts.
- `views.ts` for rendered elements intentionally reused outside the Feature.
- `runtime.ts` for Effect services and Layers used in runtime assembly.

Create only the entries with consumers. Internal code normally lives under
`model/`, `state/`, `react/`, and `ui/`. Orchestration-heavy features separate
Atom-independent services in `state/orchestration/` from reactive adapters in
`state/atoms/`.

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
projections. Effect services own asynchronous orchestration, side effects,
concurrency, retry, rollback, and scoped lifetimes. Effect Atom owns reactive
composition and the adapter between services and rendering. React renders
published state and dispatches semantic commands. See
[ADR 0002](../../docs/adr/0002-effect-and-effect-atom-own-application-logic.md).

An orchestration-heavy Feature exposes one feature-owned Effect service. The
application or wallet runtime composes it once and resolves static dependencies
during Layer construction. Runtime operations do not accept Atoms, registries,
or Atom contexts.

Command Atoms are deliberately shallow. A command may read a snapshot,
normalize it through a pure function, and perform one state transition, scoped
handle operation, or tail delegation. Multi-step coordination belongs in the
owning Effect service.

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

Resource and workflow retention is an explicit ownership decision. Use the
shared application-runtime lifecycle adapter for scoped handles rather than
rebuilding mount graphs in Features.

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

- dependency-cruiser enforces cross-Module direction and keeps API internals
  private.
- Biome constrains barrels and keeps React out of domain, Resource, and service
  logic.
- ast-grep rejects ad hoc Atom runtimes, direct Effect runtime execution, native
  `Date`, global `fetch`, throws in Effect generators, and wildcard Module
  exports.
- Knip checks ordinary and production reachability.

Run `mise exec -- pnpm check-hygiene` after changing the module graph. Change
the implementation or the exact policy when the design changes; do not silence
the checks broadly.
