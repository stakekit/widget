# Widget architecture

## Module ownership

Production code is organized by ownership rather than by React mechanism:

- `src/app` owns public-input normalization, runtime construction, provider
  composition, and classic/dashboard route composition.
- `src/services` owns Effect services and side effects: API transport,
  persistence, tracking, wallet integration, workflow execution, and borrow
  execution.
- `src/features/<feature>` owns feature state, resources, React adapters, and
  screens. A feature exposes cross-feature collaboration only through an
  intentional root entry such as `index.ts`, `support.ts`, `state.ts`, `ui.ts`,
  or another narrowly named entrypoint.
- `src/domain` owns framework-independent schemas, identifiers, and business
  rules. Approved domain schema modules may adapt generated schemas, but domain
  code must not depend on React, services, or features.
- `src/shared` owns framework-neutral utilities and genuinely reusable React or
  UI primitives. Shared modules must not depend on app, services, or features.

The retired top-level `hooks`, `providers`, `pages`, `pages-dashboard`,
`components`, `common`, `atoms`, and `borrow` ownership buckets must not be
reintroduced. A hook belongs in its feature's `react` or `ui` area; a provider
belongs in `app/composition` only when it composes the application or adapts a
third-party tree-scoped contract.

## Dependency direction and public entries

The intended direction is:

`public entry -> app composition/routes -> feature public entries -> app runtime -> services -> domain/shared`

Feature-to-feature collaboration must use an explicit supported entrypoint;
deep imports into another feature are forbidden. Services may depend on other
services, domain, shared code, and generated clients where approved, but never
on React or features. Rev-dep enforces module direction, public-entry usage,
cycles, unresolved imports, and orphaned modules. Biome confines generated API
imports, rejects React dependencies in services, and blocks retired
architecture paths.

## Effect services

Each Effect service keeps its service definition and common layer builders
colocated. Alternative implementations are additional layer builders on the
service or layers defined next to the integrating adapter; contract and default
implementation are not split into files without a concrete reason.

React hooks and components invoke effects through feature-owned atoms. Network,
persistence, tracking, wallet, polling, and transaction side effects belong in
services rather than UI hooks. Generated runtime API clients are private to
`services/api`; approved `domain/schema` and `domain/borrow` modules may import
generated schema artifacts only.

## Application runtime

`src/app/runtime/app-runtime.ts` contains the only production `Atom.runtime`.
Its fresh application layer composes bootstrap configuration, focused yield,
legacy and borrow API services, rich errors, persistence, tracking, wallet,
workflow execution, and borrow execution services. Borrow configuration is
optional at construction time; invoking an unavailable borrow operation
produces the typed error.

All application atoms resolve dependencies through `appRuntime`. Feature-local
atoms may own synchronous state directly, but must not construct another
runtime or hide an independent service graph. Mounting a widget creates a new
registry and lifecycle-sensitive service state; remounting therefore starts
cleanly.

## Effect Atom state conventions

Effect atoms own application configuration, asynchronous resources, workflow
state, mutations, and cross-feature read models. Resource keys must describe
their complete input, failures remain typed, and mutation success refreshes
only declared dependent resources. React hooks should be thin adapters over
atoms or derived read models, not alternate state owners.

Use React Context only when the value is inherently tree-scoped, such as a
compound component, host DOM element, router history adapter, or required
third-party provider. Do not introduce new page or application-state contexts.

## Supported lifecycle

The package supports one active StakeKit widget instance per document.
Mounting multiple widgets concurrently on the same page is unsupported. A
single widget may be unmounted and mounted again; registry-owned workflow and
lifecycle state is recreated for that new mount.

## React Context policy

Effect atoms own widget configuration, feature workflow state, shared read
models, and application lifecycle state. React Context is reserved for values
whose meaning is the React subtree itself or for libraries that require their
own provider.

The remaining widget-owned contexts are intentional:

- `CollapsibleContext`, `CopyTextContext`, `SelectModalContext`, and the amount
  toggle context are private compound-component contracts. Their state belongs
  to one component subtree.
- `BackButtonContext` is a compound layout override that marks the dashboard
  subtree in which a back button is rendered.
- `CurrentLayoutContext` coordinates measurements between the active routed
  page and its surrounding animated layout.
- `SKLocationContext` adapts the current and previous React Router locations
  for the routed subtree.
- `RootElementContext` exposes the widget host element to portal and overlay
  descendants in that host subtree.

Effect Atom's registry context and the contexts supplied by i18next, TanStack
Query, Wagmi, RainbowKit, and the Solana wallet adapters are third-party runtime
contracts and remain at application composition boundaries.

Page workflows must not introduce React contexts. Earn, position details,
activity, completion, transaction flow, tracking, summary, configuration, and
mount-animation state are registry-scoped atoms or models derived from atoms.

## Transaction flows

Transaction execution is split by ownership:

- `features/classic-transaction-flow` owns the Classic Review, Steps, and
  Complete journey and its Flow Session.
- `features/borrow-transaction-flow` owns the Borrow Review, Steps, and Complete
  journey and its Flow Session. `features/borrow` starts it through immutable
  intake and observes its read-only lifecycle outcomes; the flow never imports
  the Borrow feature.
- `features/transaction-workflow` owns one fresh scoped execution machine per
  immutable Transaction Workflow Input. Its scoped Atom is the sole lifecycle
  owner; returned read capabilities are passive and retained commands cannot
  revive the machine after that scope exits.

The shared Transaction Workflow contains execution mechanics only. Journey
projection, routing, handoff cleanup, and completion behavior remain in the
Classic and Borrow adapters.
