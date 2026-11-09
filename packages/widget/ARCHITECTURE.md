# Widget Architecture

This document records stable ownership and dependency boundaries. Behavior,
route topology, failure presentation, and detailed workflows belong in code and
tests. Executable policy lives in oxlint, dependency-cruiser, the Effect
language service, Knip, and jscpd.

## Ownership

`packages/widget/src` is organized by the owner of a capability:

```text
app/          application composition, Layouts, routing, and runtime assembly
features/     user-facing capabilities and their state
runtime/      the Application Runtime and the Atom runtimes Features and Resources build on
resources/    authoritative cacheable remote reads
services/     side effects and external-system adapters
domain/       framework-independent rules and models
ui/           the Design System: every visual decision and UI building block
shared/       neutral non-visual utilities
public-api/   host-facing types
```

The layers and what each may import are declared once, in
`scripts/architecture/module-map.ts`; every architecture check derives its paths
from it.

Code stays private to its owner unless another owner needs a deliberate
interface. Shared is for neutral non-visual building blocks, not displaced
feature logic or UI. Shared may depend on Domain types and rules, but not on
features, resources, services, or `public-api`. The application composes
Modules; it does not absorb their behavior.

The Design System (`ui/`) owns tokens, themes, the scoped reset, primitives,
components, patterns, icons, and artwork. It is the only owner that uses StyleX,
Base UI, `motion`, Recharts, TanStack Virtual, or SVG icon markup. Features and
application composition build UI only by composing its parts, never with HTML
elements, `className`, `style`, or raw values. It imports only its own modules
and libraries, nothing from Features, Resources, services, application
composition, Domain, `public-api`, `shared`, or `generated`: it receives plain
values, and Features map their domain values onto its props. A component
shaped by one Feature lives in that Feature and composes Design System parts.
See
[ADR 0015](../../docs/adr/0015-the-design-system-owns-every-visual-decision.md)
and the [contributor guide](../../docs/design-system.md).

Activity owns the activity feed, action lookup, action details, and their
Layout-specific screens. A Yield Action Continuation starts from Activity but
runs as a Yield Transaction Flow; completed and failed details never start one.

## Layouts

The Compact Layout and the Dashboard Layout are application composition under
`app/layouts/<layout>/`: each owns its shell, route tree, tabs, and page
transitions. Widget Configuration derives the Layout from Host Configuration,
and only application composition and Widget Configuration read it. Features are
Layout-agnostic: a Feature's `ui/` holds what both Layouts render, including its
hooks and route adapters, `ui/compact/` and `ui/dashboard/` hold Layout-specific
screens and never import each other, and nothing but the Feature's
`composition.ts` imports them. A Layout
difference is a Presentation Setting, a prop the Layout's composition supplies
that names the difference, or a Layout-specific component. See
[ADR 0013](../../docs/adr/0013-layouts-are-application-composition.md).

Application composition resolves Presentation Settings from the Layout's
defaults and the Host Profile's overrides and passes them, with the resolved
color scheme and Appearance, to the Design System's theme root. The theme root
applies them to the Widget root and its portal container; no style is keyed by
the Layout. The `WidgetFrame` pattern receives the resolved presentation and
route transitions use the Design System's `PageTransition`; neither selects a
Layout.

## Routes and navigation

The Route Registry (`services/navigation/widget-routes.ts`) defines every
absolute Widget path once: its pattern, typed params, the Layouts that mount
it, how to build it, and how to match a pathname against it. Route trees mount
registry patterns, navigation accepts only registry-built `WidgetPath`s, and
pathname parsing uses registry matching; only relative redirects stay literal.
Building a route that some Layout does not mount requires naming the Layout. A
Transaction Flow's Review, Steps, and Complete form one flow group per mount.
The owning Feature or application composition binds the navigation-state schema
to its route or flow group. Presentation changes carried by navigation apply
only after the router accepts it, so blocked navigation cannot remount the
current page. The `navigation` Feature adapts the registry to React.

Navigation that completes a domain operation, such as a handoff with its
navigation or a deep link, runs in that Effect operation through the
`WidgetNavigation` service. Navigation that only answers a user's UI action,
such as a tab press or a back button, stays in React.

## Dependency direction

Dependencies point toward narrow interfaces and stable lower-level concepts:

```text
outbound package entries
          |
          v
application composition and runtime assembly (app/)
          |
          v
feature interfaces
          |
          v
resource interfaces
          |
          v
Atom runtimes (runtime/)
          |
          v
services / domain rules / shared utilities
```

Features and application composition also use the Design System. The direction
holds between Modules, not only between files: the architecture check fails on
any cycle between Modules, with no baseline.

Imports within a Module may target its implementation. Imports across Modules
use that Module's interface. Generated API clients and transport details remain
private to `services/api`.

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
derived exceptions are stable Domain contract re-exports.

Hosts theme the Widget through `appearance` (`SKAppearance`), a hand-written
type of Color Roles per color scheme plus radius, control-height, font, and
weight settings, and pick the Layout through `layout`. Both are decoded at the
Host Configuration boundary into the Design System's internal Appearance and
the Layout. The deprecated `theme`, `lightTheme`, `darkTheme`, and
`dashboardVariant` stay accepted until the next major version; the boundary
maps a legacy `theme`'s customized values onto Color Roles under `appearance`,
and maps `dashboardVariant` to `layout`. The Design System's CSS custom
properties are not a host contract.

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

An Owned Module (a Module, for short) is an immediate child of `features/`,
`resources/`, `services/`, `domain/`, or `shared/` (a directory or a single
file), or a child of a Module Collection such as `features/borrow/`. Every
other layer (`app`, `runtime`, `ui`, `public-api`, `generated`) is one Module.
A Module's root files are its interface; its subdirectories are private,
`internal/` and the Feature tiers alike. Modules are not registered one by one:
the folder layout is the policy, and the Module map declares only the layers
and the Module Collections, as recorded in
[ADR 0007](../../docs/adr/0007-owned-modules-expose-finite-interfaces.md). A
Module keeps its root to the files its consumers need.

Root files named for a role have a fixed audience or content:

- `index.ts` for headless models, commands, Atoms, types, and zero-logic adapter
  hooks. It re-exports no rendered UI: hooks come from `.ts` files under `ui/`,
  components only through `views.ts` or `composition.ts`.
- `composition.ts` for screens, routes, layouts, providers, guards, and mounts;
  only application composition, or the Module Collection's own composition,
  imports it.
- `views.ts` for rendered elements intentionally reused outside the Module;
  runtimes never import it.
- `runtime.ts` for operations used in runtime construction and assembly; only
  `runtime/` and `app/runtime/` import it.

A Module's own files import its implementation directly, never its role files.
A Feature creates only the role files with consumers; its implementation lives
under `model/`, `state/`, and `ui/`, so its root holds nothing else. The tiers
match ADR 0002 and depend downward: `ui/` (React: components, hooks, route
adapters) → `state/` (Effect and Atom) → `model/` (plain TypeScript). `model/`
and `state/` import no React. `ui/` never reads an `AsyncResult`: `state/`
publishes plain values or view states, such as a flow's execution status, for
it to render. `state/` is organized by page: a page module holds its page's
Atom family and the Effect functions only that page runs; what several pages
share, such as starting or leaving a flow, lives in a module of its own.

A Resource Module's root files define its Resource. A Module Collection
consumes its children's interfaces and publishes its own facade from them; it
never reaches a child's private files.

`services/api` is one Module with purpose-specific interfaces:

- `resource-sources.ts` for Resources.
- `operations.ts` for Feature `state/` and transaction internals.
- `runtime.ts` for the Application Runtime.

Transport, generated clients, and capability implementations live in its
`internal/`.

Interface exports are explicit and named, and an interface re-exports only its
own Module. Wildcard exports and convenience barrels are not interfaces. Tests
may deep-import private machinery when the test is intentionally about that
machinery.

The Design System publishes:

- `index.ts` for Features and application composition: primitives, components,
  patterns, and their finite prop types.
- `composition.ts` for application composition only: the theme root, which
  themes the Widget root and the portal container inside it, and theme
  resolution. The theme root takes the resolved
  color scheme and the Appearance that Widget Configuration carries as plain
  values; the `system` color scheme is resolved by a service in `services/`,
  projected into an Atom.

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

The Atom runtimes Features and Resources build on (`appRuntime`,
`walletRuntime`, and the Widget Configuration Atoms they read) live in
`runtime/`, below the Features. A runtime that needs a Feature's operation, such
as the Deep Link Coordinator starting a Yield Transaction Flow, is assembled in
`app/runtime/` on top of the runtime it extends, so no lower runtime imports a
Feature.

The Widget is designed and tested for one mounted Widget Instance per browser
document, though runtime claims no longer block concurrent mounts. Unmounting and
later mounting a new instance creates a fresh generation. See
[ADR 0001](../../docs/adr/0001-one-widget-instance-per-browser-document.md).

React Context is limited to real render-tree concerns and third-party provider
boundaries. Application services and cross-feature state use the Effect runtime
and Effect Atom registry.

## Enforcement

- dependency-cruiser (`scripts/architecture/dependency-cruiser.config.mts`)
  owns every import rule, generated from the Module map: the layer matrix,
  private Module subdirectories, the audiences of role files, re-exports only of
  a Module's own code, downward Feature tiers, React only outside headless
  code (`domain`, `runtime`, Resources, services, `app/runtime`, and `model/`
  and `state/`), outbound-only package entries, the `services/api` interfaces,
  API transport free of error presentation, and `ui/compact/` and
  `ui/dashboard/` independent of each other and out of Layout-free code. It
  allows StyleX, Base UI, `motion`, Recharts, TanStack Virtual, and style
  definition modules only inside the Design System, restricts other owners to
  its main and composition interfaces, and lets the Design System import only
  itself (`layer-ui`). The architecture check also fails on any cycle between
  Modules, and, through the native TypeScript 7 checker
  (`scripts/architecture/async-result-in-ui.ts`; oxlint gives JS plugins no
  types), on any `AsyncResult`-typed value in a Feature's `ui/`, however it got
  there; oxlint's `no-async-result-in-feature-ui` only catches the import.
- oxlint (the shared rules in the root `.oxlintrc.json`, the widget's in
  `packages/widget/.oxlintrc.json`) checks code shape, not imports. With type
  information it rejects floating and misused promises, non-exhaustive
  switches and unsafe type assertions in `src`. `lint` runs it on the
  Effect-patched tsrs, which type-checks `tsconfig.json` in the same pass.
- The widget's oxlint plugins (`scripts/oxlint/`, one rule per policy, each
  carrying its own file scope, tested in `tests/scripts/oxlint/`) reject
  manual memoization (`useMemo`, `useCallback`, `memo`; React Compiler
  memoizes, and only functions with a `"use no memo"` directive may memoize by
  hand), Atom runtimes outside `runtime/` and `app/runtime/`, direct Effect
  runtime execution, native `Date`, throws in Effect generators, wildcard
  exports and barrels outside Module interfaces (the Module map's root files),
  Resources that read an API ResourceSource without `makePresentableResource`,
  literal absolute Widget paths outside the Route Registry, Layout reads outside
  application composition and Widget Configuration, Layout-named identifiers in
  Domain, runtime, Resource, service, and Feature `model/` and `state/` code,
  Layout-named files outside `ui/` and `app/layouts/`, and suppressions that
  name no rule or give no reason after `--`.
- The `design-system` oxlint plugin rejects lowercase JSX elements,
  `createElement` calls with a lowercase tag, and `className` or `style`
  attributes (spread too) in Features and application composition, and,
  inside the Design System outside its token definitions and artwork, color
  literals and raw font size, weight, line height, radius, shadow, z-index,
  duration, and px, rem, em, ch, vw, and vh values.
- oxlint runs StyleX's lint rules (valid styles, unused styles, valid
  shorthands, sorted keys) on the Design System as part of the widget `lint`.
- The Design System rules apply to every file, with no exemption list; the
  only exceptions are suppressions that state their reason. See
  [the contributor guide](../../docs/design-system.md#enforcement).
- Design System parts omit `className` and `style` from their types, and `as`
  is a finite union.
- Every Design System part and variant has a story that runs as a Chromium
  test, with accessibility violations failing it; a contrast test checks every
  text/surface Color Role pair in every scheme and Appearance Preset but Utila,
  which keeps its shipped palette by product decision
  ([ADR 0015](../../docs/adr/0015-the-design-system-owns-every-visual-decision.md)).
- The Effect language service (configured in `tsconfig.json`, run by `lint`)
  fails on every Effect diagnostic. In `src` it also enforces the default-off
  rules: deterministic service keys, Schema class constructors, typed `Effect.try`
  failures, Effect APIs over global JSON, timers, dates, randomness and
  promises, and Effect code over `async` functions. `.tsx` files and the
  wallet internals may declare `async` functions (React event handlers and the
  Promise-based wallet SDK contracts), wallet adapters may build promises and
  timers for those contracts, `shared/react` and the Design System (`ui/`) may
  use timers, and stories may build promises for their play functions. Each
  exemption, each rule kept off and each single-line
  `@effect-diagnostics` directive carries its reason. Build a string key from
  JSON parts with `compositeKey` (`shared/lib/composite-key.ts`), not
  `JSON.stringify`.
- Architecture rules live in these tools, not in tests that read source text.
- Knip checks ordinary and production reachability.
- jscpd fails when duplicated source and tooling code (tests and generated API
  clients excluded) exceeds 1% of lines.

Run `mise exec -- pnpm check-hygiene` after changing the module graph. Change
the implementation or the exact policy when the design changes; do not silence
the checks broadly.
