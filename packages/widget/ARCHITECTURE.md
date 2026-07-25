# Widget architecture

## Module ownership

Production code is organized by ownership rather than by React mechanism:

- `src/app` owns public-input normalization, runtime construction, provider
  composition, and classic/dashboard route composition.
- `src/resources` owns Authoritative Resources: app-runtime-scoped, cacheable
  remote reads shared across features. Each remote fact has one named, typed
  resource module rather than a global registry.
- `src/services` owns Effect services and side effects: API transport,
  persistence, tracking, widget navigation, wallet integration, workflow
  execution, and borrow execution.
- `src/features/<feature>` owns feature state, contextual read models, command
  atoms, React adapters, and screens. A feature exposes cross-feature
  collaboration only through an intentional root entry such as `index.ts`,
  `support.ts`, `state.ts`, `ui.ts`, or another narrowly named entrypoint.
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

The intended read direction is:

`public entry -> app composition/routes -> feature public entries -> resources -> app runtime -> services -> domain/shared`

Feature commands and workflows may use operation capability services through
the app runtime, but feature read models do not bypass Authoritative Resources
to call read-side API capabilities directly. The owning operation importers are
the Classic and Borrow Flow Session facades plus the Transaction Workflow
operations service. Wallet Bootstrap is the only read-source exception: it
acquires enabled networks and an optional initial Yield while constructing the
wallet runtime, before feature resources are available.

Feature-to-feature collaboration must use an explicit supported entrypoint;
deep imports into another feature are forbidden. Resources may depend on the
app runtime, resource-source capability services, domain, shared code, and
public types, but never on features or React. Services may depend on other
services, domain, shared code, and generated clients where approved, but never
on resources, React, or features. Rev-dep enforces module direction,
public-entry usage, resource-source importer restrictions, cycles, unresolved
imports, and orphaned modules. Biome confines generated API imports, rejects
React dependencies in Authoritative Resources, and blocks retired architecture
paths. Application runtime composition and tests are permitted to construct
capability layers; approved domain schema adapters may import generated schema
artifacts, but generated runtime clients remain private to `services/api`.

## Effect services

Each Effect service keeps its service definition and common layer builders
colocated. Alternative implementations are additional layer builders on the
service or layers defined next to the integrating adapter; contract and default
implementation are not split into files without a concrete reason.

Backend integration is exposed through coarse capability ports rather than one
broad service or one port per endpoint. Resource-source capabilities contain
cacheable reads and may be consumed only by `src/resources`; operation
capabilities contain mutations and transient execution operations and may be
consumed by feature command atoms or deeper workflow operation modules. A
backend without mutations does not receive an empty operation capability for
symmetry.

`ApiTransportService` remains private transport infrastructure that constructs
generated clients and applies common HTTP configuration. Generated clients and
the transport are not imported by resources or features. The former broad
`YieldApiService`, `LegacyApiService`, and `BorrowApiService` contracts are
replaced by Yield, Legacy, and Borrow resource-source and operation
capabilities. Capability implementations perform transport mapping and domain
decoding; Authoritative Resources add caching and reactive lifetimes.

React hooks and components invoke effects through feature-owned atoms. Network,
persistence, tracking, wallet, polling, and transaction side effects belong in
Effect services and Authoritative Resources rather than UI hooks. Generated
runtime API clients are private to `services/api`; approved `domain/schema` and
`domain/borrow` modules may import generated schema artifacts only.

## Application runtime

`src/app/runtime/application-router-runtime.ts` is a synchronous base runtime
that constructs the scoped `ApplicationRouter` around the memory router.
`app-runtime.ts` consumes that router context and composes bootstrap
configuration, focused Yield, Legacy, and Borrow capability ports, rich errors,
persistence, tracking, `WidgetNavigation`, and wallet-modal commands. The
derived `wallet-runtime.ts` receives the application context and adds its scoped
wallet and transaction-workflow services.
Borrow configuration is optional at construction time; invoking an unavailable
borrow capability produces the typed error.

All application atoms resolve dependencies through `appRuntime`. Feature-local
atoms may own synchronous state directly, but must not construct another
runtime or hide an independent service graph. The Application Router base
runtime is the only lower-level exception and contains no feature services.
Mounting a widget creates a new registry and lifecycle-sensitive service state;
remounting therefore starts cleanly.

`ApplicationRouter` owns one memory router for an Application Runtime
Generation and disposes it with that generation. The root route configuration is
assembled at the top-level React composition seam in `App.tsx` and seeded into
the registry when it is created, so runtime construction does not import React
composition. React synchronously reads the router from an internal Atom only to
pass it to `RouterProvider`.
`WidgetNavigation` is constructed directly from `ApplicationRouter` and is the
headless application-runtime command interface. Application-owned navigation
uses canonical absolute paths from commands and workflow transition events;
derived view Atoms do not publish navigation outcomes for React to apply.
Declarative route guards and view-local navigation remain React concerns.

## Effect Atom state conventions

Effect atoms own application configuration, asynchronous resources, workflow
state, mutations, and cross-feature read models. Resource keys must describe
their complete input, failures remain typed, and mutation success refreshes
only declared dependent resources. React hooks should be thin adapters over
atoms or derived read models, not alternate state owners.

An Authoritative Resource is the sole owner of one cacheable canonical remote
fact. Its interface accepts complete explicit identity and never reads current,
selected, or visible feature state. It caches decoded domain-facing facts
rather than generated transport DTOs or feature-shaped read models. Features
bind current Wallet Scope and other contextual inputs, then derive eligibility,
selection, summaries, and UI state from the resource result.

Equivalent semantic requests use one canonical Atom identity. Cross-request
entity normalization is opt-in per resource and is introduced only when the
resource proves that response shapes, completeness, freshness, and missing-item
semantics are compatible. Resource state, including normalized entities, is
scoped to one Widget Instance's Atom registry and is never stored in a
module-global cache or independent runtime.

Each resource module owns its stale and idle policy, retry behavior, polling,
request concurrency, pagination, partial-response policy, typed failures, and
stale-result behavior. Callers may observe, load more through a semantic pull
interface, request explicit retry or refresh, and derive new Atoms; they do not
choose offsets, page sizes, cache policy, or retry schedules.

Commands publish semantic invalidation keys for changed remote facts. Resource
modules subscribe by their explicit identity, so one invalidation refreshes all
affected cached queries without commands importing concrete Atom families.
Direct refresh is reserved for explicit retry or user refresh.

Migration to Authoritative Resources proceeds as completed vertical slices.
Each slice introduces its capability port and resource, migrates every caller,
replaces feature-specific projections, adds interface-level tests, and removes
the previous atoms and duplicate client methods before the next slice begins.
Existing direct feature reads are migration debt and must not be copied into new
or materially refactored code.

Feature facades expose stable read-only view Atoms and writable command Atoms.
They retain mutable state, dynamic resource Atom identities, retry targets, and
pagination implementations privately. Published view values contain neither
nested Atoms or Atom factories nor command callbacks; the facade resolves the
active resource and forwards user intent internally. Deterministic
calculations remain plain TypeScript.

`features/yield-entry` owns the shared Yield Entry capability used by Earn and
position details: amount constraints, validation, KYC projection, Enter Action
Command preparation, submission decisions, and their command effects.
`features/yield-summary` owns shared read-only yield projections such as
provider details, reward-token details, and semantic yield type. Earn,
position details, transaction flows, activity, and portfolio consume these
modules through narrow public entries rather than importing implementation
from one another.

Use React Context only when the value is inherently tree-scoped, such as a
compound component, host DOM element, router-rendered application route
content, or required third-party provider. Do not introduce new page or
application-state contexts.

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

- `ApplicationRouteContentContext` supplies the application subtree to the
  static data-router root route without making the route definition depend on
  application providers.
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

RainbowKit exposes modal commands only through React Context. One named
provider adapter installs connect- and chain-modal commands into the
runtime-scoped `WalletModal` interface and releases them with the provider
lifetime. Feature state never stores or transports those callbacks, and no
module-global latest-callback holder is used.

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
projection, navigation decisions, handoff cleanup, and completion behavior
remain in the Classic and Borrow modules; application-owned destinations are
executed through the application-runtime `WidgetNavigation` module.
