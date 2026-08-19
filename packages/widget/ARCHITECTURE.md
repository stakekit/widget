# Widget architecture

## Module ownership

Production code is organized by ownership rather than by React mechanism:

- `src/app` owns the Host Configuration binding, runtime construction, provider
  composition, Classic/Dashboard shell route composition, feature route mount
  paths, and app-level route guards. `src/services/config` owns Host
  Configuration defaults and normalization.
- `src/resources` owns Authoritative Resources: app-runtime-scoped, cacheable
  remote reads shared across features. Each remote fact has one named, typed
  resource module rather than a global registry.
- `src/services` owns Effect services and side effects: API transport,
  persistence, tracking, translation, widget navigation, wallet integration,
  workflow execution, and borrow execution.
- `src/features/<feature>` owns feature state, contextual read models, command
  atoms, React adapters, and screens. Each Feature is an owned Module in the
  declared Feature Module Collection; its implementation is private and its
  finite interfaces are described below.

- `src/domain` owns framework-independent schemas, identifiers, and business
  rules. Approved domain schema modules may adapt generated schemas, but domain
  code must not depend on React, services, features, or `shared`. `shared`
  depends on `domain`, so the edge runs one way only; a utility that only
  domain uses belongs in `domain`.
  Wallet Network, Wallet Scope, and Wallet Scope Owner identity are domain
  concepts. Wallet adapters own conversion from Wallet State and the stricter
  command identity that includes connector details.
- `src/shared` owns framework-neutral utilities and genuinely reusable React or
  UI primitives, including the widget's UI kit in `src/shared/ui`. Shared
  modules must not depend on app, services, or features. Kit components are
  imported directly by path; `shared` publishes no barrels.

### Module interfaces

ADR-0023 replaced the repeated per-Feature entry convention with a generic
Module Collection policy.

Production dependencies are default-deny across App, Feature, Resource,
Service, Domain, Shared, Generated, and Public API layers. A declared Module
Collection discovers every current and future child Module without listing its
names. Same-Module imports may reach implementation directly; every dependency
from outside the owner must use an interface allowed for that Module Kind.

A Feature Module may publish only the interfaces it actually needs:

- `index.ts` — non-rendering models, Atoms, commands, published types, and
  zero-logic React adapter hooks.
- `composition.ts` — routes, screens, layouts, providers, guards, and global
  mounts consumed by application or enclosing-Module composition.
- `views.ts` — rendered elements and rendering-only hooks intentionally reusable
  by the application, peer Modules, or an outbound package entrypoint.
- `runtime.ts` — Effect modules and Layers consumed only by application or
  enclosing-Module runtime assembly.

A Resource Module is each immediate child of `src/resources` and publishes one
required `index.ts`. It publishes no composition, view, or runtime interface.
Nested Module Collections use the same interface roles. An enclosing Module
composes a child interface behind an owner-defined facade or composer; it does
not deep-import the child or transitively publish child-owned symbols.

Interface files may define behavior or explicitly re-export owned symbols.
Wildcard and namespace-wildcard exports are forbidden. A Module's own
implementation does not import through its interfaces, and type-only and
dynamic imports follow the same ownership and layer rules as value imports.
The singular API Module is the deliberate internal composition case: its
`runtime.ts` assembles the capability Tags declared by its audience interfaces,
while the transport and capability implementations remain private.
Tests may deep-import implementation. Cross-Module style implementation access
is allowed only from one `*.css.ts` module to another; ordinary TypeScript and
TSX callers use an interface.
All other exceptions are exact, named importer-to-target rules with a rationale
and, when temporary, a removal condition.

The retired top-level `hooks`, `providers`, `pages`, `pages-dashboard`,
`components`, `common`, `atoms`, and `borrow` ownership buckets must not be
reintroduced. A hook belongs in its feature's `react` or `ui` area; a provider
belongs in `app/composition` only when it composes the application or adapts a
third-party tree-scoped contract.

## Dependency direction and public entries

The intended read direction is:

`public entry -> app composition/routes -> feature public entries -> resources -> app runtime -> services -> domain/shared`

Feature orchestration and workflows may use operation capability services
through the app runtime, but feature read models and command Atoms do not bypass Authoritative Resources
to call read-side API capabilities directly. The owning operation importers are
the Classic and Borrow Flow Review orchestration modules, and the Transaction
Workflow runtime. Wallet Bootstrap depends on its own `WalletBootstrapSource`
port. API runtime adapts the required enabled-network and initial-Yield reads to
that port, so Wallet does not import the Resource Source interface.

Feature-to-feature collaboration must use an allowed Module interface;
deep imports into another Feature fail the architecture check. Importing a
Feature root module that is not one of its four interface kinds counts as a
deep import and fails the same check. Tests may deep-import Feature
internals, since they assert on internal behaviour by design. Resources may depend on the
app runtime, resource-source capability services, domain, shared code, and
public types, but never on features or React. Services may depend on other
services, domain, shared code, and generated clients where approved, but never
on resources, React, or features. The executable architecture policy enforces
module direction, interface usage, resource-source importer restrictions,
cycles, and unresolved imports. Knip detects unused files, exports, types, and
dependencies.
Dependency-cruiser keeps generated runtime clients private to the API Module.
Biome rejects React dependencies in Authoritative Resources and limits barrel
locations. The API
`runtime.ts` interface is the only production Layer assembly seam for API
capabilities; approved domain schema adapters may import generated schema
artifacts, but generated runtime clients remain private to `services/api`.

The executable dependency policy in
`scripts/dependency-cruiser.config.mts` owns the layer matrix, Module
interfaces, privileged importers, cycles, and resolution. Knip's ordinary and
production modes own unused files, exports, types, packages, and production
reachability. The required Resource `index.ts` remains a Module contract:
dependency-cruiser rejects external deep imports, while Knip rejects
unreachable Resource implementations. Ast-grep rejects wildcard exports from
Module interfaces. The dependency scan is restricted to production `src`; it
does not test whether Biome or ast-grep configuration mirrors the policy.
Cycle detection applies to both concrete source files and the graph produced by
collapsing those files to their declared owned Modules. A pair or cluster of
Modules may not depend on one another merely because their individual files do
not form a concrete import cycle. The Module-level check consumes
dependency-cruiser's resolved graph and the same typed Module Collection
declarations; it does not maintain a rev-dep-style ownership configuration.
Every declared Feature, nested Feature, Resource, and singular owned Module is
a graph node; the most-specific nested owner wins, parent-root files remain in
the parent, and intra-Module dependencies are ignored. Exact directed edges in
the existing cyclic components may be temporarily baselined only during their
active removal slice, with a stated removal condition. Baselining only component
membership is insufficient because it could conceal a new edge. No baseline
remains after the migration. A failure reports both the owned-Module cycle and
the contributing concrete file imports.
Rev-dep and its repeated
per-Feature configuration were removed after the ADR-0023 cutover.

### The shared UI kit and its inverted configuration

`src/shared/ui/components` owns the generic kit: select modal, tooltip,
dropdown, number input, max button, collapsible, divider, amount toggle, token
and provider icons, and the virtual lists. None of it reads widget
configuration. Where a component needs a host preference — the overlay portal
element, the theme variant its recipe styles resolve against, icon overrides,
or the input auto-resize switch — it reads the `WidgetPresentation` contract
that `shared/ui` itself declares, and
`app/composition/providers/widget-presentation.tsx` populates that contract
from the read-only Widget Configuration projection. The dependency therefore points from app into shared, and
the `shared` boundary stays limited to `shared` and `domain`.

A Feature's `views.ts` publishes rendered elements and rendering-only hooks
that carry that Feature's domain meaning. `widget-shell/views.ts` publishes shell chrome — page
container, page CTA, back button, tab and layout styles, maintenance screen.
Generic detail rows, position-detail panes, breadcrumbs, metrics, and
breakdowns belong in `shared/ui`; shared yield read presentation such as the
yield detail header, formatting rules, KYC, reward, provider, risk, and
metadata belongs to Yield Summary; Validator and entry interaction
presentation belongs to Yield Entry; Earn publishes only Earn-journey
presentation. A generic component that acquires no domain meaning belongs in
the kit, not behind a feature entry. Position Details does not publish raw
style contracts to peer Features.

Application composition owns peer Feature composition. When shell chrome needs
a Portfolio projection such as pending-action count, the application supplies
that projection to the shell interface; Widget Shell and Portfolio do not
import one another.

## Effect services

Each Effect service normally keeps its service definition and common layer
builders colocated. Alternative implementations are additional layer builders
on the service or layers defined next to the integrating adapter. The singular
API Module is the concrete exception: audience interfaces own explicit
capability contracts and `runtime.ts` privately assembles their implementations.

Backend integration is exposed through coarse capability ports rather than one
broad service or one port per endpoint. Resource-source capabilities contain
cacheable reads and may be consumed only by `src/resources`; operation
capabilities contain mutations and transient execution operations and may be
consumed only by Feature orchestration or Transaction Workflow internals. A
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
runtime API clients are private to `services/api`; approved concept modules in
`domain` may import generated schema artifacts to define canonical App Models.
Those modules colocate runtime schemas with the rules for the same concept;
technical-kind `schema` and `types` folders are not used.

## Application orchestration

Plain TypeScript owns deterministic constructors, decisions, transitions,
invariants, and projections. Feature-owned, Atom-independent Effect modules own
multi-step orchestration, command concurrency, retries, rollback, typed
operational failures, and scoped lifetimes. An orchestration-heavy feature has
one feature-owned Effect service as its external implementation seam. The
application or wallet runtime constructs that service once, resolves its static
dependencies during layer construction, and keeps it alive independently of
route mounts. Private child modules may be scoped factories when their Session,
action, eligibility, or other inputs genuinely vary by route scope. Operations
do not locally re-provide dependencies that composition already resolved.

An orchestration interface publishes semantic operations rather than one
generic tagged-command dispatcher. Observable channels are demand-driven: a
read-only state Stream exists when production needs changing authoritative
facts, and an event Stream exists only for a production observer that cannot
use state or an operation outcome. The module directly performs navigation,
tracking, and other side effects required by an accepted operation. Widget
Domain Events carry closed cross-feature lifecycle facts; feature-owned
projections interpret them and may invoke private state or resource commands
without turning events into an instruction bus. Its interface never accepts or returns an Atom, registry, Atom
context, or command context. Feature `model/` modules likewise never import
Effect Atom; Atom adapters materialize explicit resource observations before
invoking deterministic logic.

Command Atoms are narrow adapters. They may read the current reactive snapshot,
normalize it through a pure function, and then perform exactly one local state
transition, one scoped-handle operation, or one cross-feature tail delegation
before mapping the typed result. One telemetry effect may accompany that
operation only when it cannot affect eligibility, ordering, state, navigation,
retry, or the command outcome. Commands do not access the registry directly,
subscribe, mount, refresh-and-wait, retry, coordinate multiple commands, or
perform compensating writes. A shared lifecycle adapter under `src/app/runtime`
hides scoped-handle acquisition, keep-alive, optional state projection, and
release; feature authors and callers do not manually reproduce a mount graph.
Authoritative Resources retain the Atom machinery required for reactive caching
and resource policy.

Workflow facts have one authoritative writer. State owned by an Effect
lifecycle module may be mirrored or projected into Atom but is not independently
writable there. Expected command ineligibility is a typed outcome; operational
failure uses the Effect error channel; impossible states are defects.

Transaction Flow orchestration follows the domain lifetimes: one feature-owned
service owns the active Flow Session store, each Flow Session owns private
handoff capabilities, and Review and Execution are fresh child scopes. Classic
and Borrow retain separate journey-specific services and share neutral lifecycle
infrastructure only. Flow services consume `WalletService` directly for current
Wallet Scope validation and autonomous owner invalidation; Atom wallet
projections do not feed orchestration.

## Application runtime

`src/app/runtime/application-router-runtime.ts` is a synchronous base runtime
that constructs `WidgetConfigService` from Host Configuration and the scoped
`ApplicationRouter` around the memory router. `WidgetConfigService` trusts the
typed public boundary and exclusively owns one pure normalization pass, the
current Widget Configuration, and its non-failing value stream. The root React
binding is its only update adapter; read-only Atoms project current
configuration for React and reactive feature reads. Consumer projections may
select, regroup, or index canonical values but never apply configuration
defaults or canonicalization.
`app-runtime.ts` consumes that router context and composes the API Module's
single runtime Layer, bootstrap configuration, rich errors,
persistence, tracking, `WidgetTranslation`, `WidgetNavigation`, wallet-modal
commands, and one `WidgetDomainEvents` service. The derived `wallet-runtime.ts` receives the application context and adds its scoped
wallet, transaction-workflow, Classic Transaction Flow,
Borrow Transaction Flow, and Yield Entry submission services. It consumes the
three Feature `runtime.ts` interfaces without exposing their private
orchestration modules.
Borrow configuration is optional at construction time; invoking an unavailable
borrow capability produces the typed error.

Application atoms resolve dependencies through `appRuntime` or its derived
`walletRuntime` when they require wallet-scoped services. Feature-local atoms
may own synchronous state directly, but must not construct another runtime or
hide an independent service graph. The Application Router base runtime is the
only lower-level exception and contains no feature services.
Mounting a widget creates a new registry and lifecycle-sensitive service state;
remounting therefore starts cleanly.

`ApplicationRouter` owns one memory router for an Application Runtime
Generation and disposes it when the Widget Instance unmounts. Application API
Identity is fixed for that mounted generation; changing it terminally fails the
configuration service and unmounts the React tree. The root route configuration is
assembled at the top-level React composition seam in `App.tsx` and seeded into
the registry when it is created, so runtime construction does not import React
composition. React synchronously reads the router from an internal Atom only to
pass it to `RouterProvider`.
`WidgetNavigation` is constructed directly from `ApplicationRouter` and owns the
closed Back, Push, and Replace command union plus its `execute` interpreter.
Application-owned navigation uses canonical absolute paths; orchestration calls
the resolved service directly and does not re-provide it at operation time.
Derived view Atoms do not publish navigation outcomes for React to apply.
Declarative route guards and view-local navigation remain React concerns.

## Effect Atom state conventions

Effect atoms project Widget Configuration and own asynchronous resources,
feature-local synchronous state, reactive resource binding, passive workflow
state projections, mutation adapters, and cross-feature read models.
Effect-native lifecycle modules own authoritative workflow state and
orchestration. Resource keys must describe their complete input, failures
remain typed, and mutation success refreshes only declared dependent resources.
React hooks should be thin adapters over atoms or derived read models, not
alternate state owners.

Production composition interfaces represent production variability. Runtime
providers, Atom constructors, and feature facades do not accept alternate
Atoms, initial registry values, or optional dependencies solely for tests.
Tests exercise deterministic production-used projections directly and test
Effect-native orchestration through the real feature service layer, its semantic
operations, and production-observable state, using test adapters for external
capabilities. Private Session, Review, and Execution factories are not separate
behavior-test surfaces. Test-owned registries verify only service lookup,
route-scope acquisition and release, reactive projection, and operation
forwarding. Keyed families, tree-scoped modules, and constructors with multiple
production compositions remain valid production seams.

The application Atom registry supplies no default idle TTL. Ordinary Atoms are
therefore transient and are disposed as soon as they become unobserved; feature
state does not survive route release merely because its Atom identity remains
reachable. Production code does not configure `defaultIdleTTL` or apply
per-Atom finite TTLs directly. `keepAlive` is reserved for modules owned by the
Application or Wallet Runtime Generation, such as runtime roots, global
coordinators, immutable generation facts, and intentional application-wide
preferences. Feature state that must survive navigation receives an explicit
owner module or persistence mechanism instead of extending its Atom lifetime.

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

Every canonical remote-read Atom uses the shared API resource policy, which
retains it for five minutes after it becomes unobserved and revalidates stale
data when it mounts. The five-minute idle lifetime is fixed rather than
resource- or caller-configurable. Each resource module still owns its stale
time, retry behavior, polling, request concurrency, pagination,
partial-response policy, typed failures, and stale-result behavior. Derived
projections, scans, command Atoms, and presentation adapters remain transient
even when they live in a
resource module. Callers may observe, load more through a semantic pull
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

State and model modules keep `AsyncResult` as the standard representation of an
asynchronous value. They use its existing value, previous-success, waiting, and
failure semantics rather than translating it into feature-local
`data`/`error`/`loading` envelopes or equivalent tagged unions. A custom
projection is justified when it adds domain meaning by combining resources or
deriving semantic states such as readiness, eligibility, pagination phase, or a
KYC gate; such projections publish only the semantic facts consumers use.

Earn Selection remains Atom-owned synchronous intent. Its Atom adapter owns
concrete Authoritative Resource identity, canonical catalog observation, and
Validator pagination, then supplies authoritative `AsyncResult` values and
plain resource-independent inputs to deterministic Earn reconciliation. Feature
model code never imports Effect Atom or accepts an Atom context, including
through type-only dependencies.

Borrow action preparation is one deterministic feature-owned seam over a
normalized draft, `Borrow Positions`, and the governing `Risk Position`. The
seam delegates to private action-specific modules and returns `Idle`, typed
`Blocked` reasons, or `Ready`; only `Ready` contains the
aligned Action Command and action-specific review summary. Risk Position
assessment is authoritative for solvency decisions. Financial totals derived
from amounts and prices are display fallbacks and never silently replace an
unavailable risk assessment. Borrow Entry and Market Position Atoms own
preparation and re-read the current `Ready` value when starting a Flow Session;
React only renders the view and dispatches intent.

Borrow Entry and Market Position own projections from owner-scoped
`TransactionWorkflowStarted` facts to private Entry Intent reset commands.
Each feature owns one active Entry Intent store, and its complete transient Atom
chain is disposed when the entry surface stops observing it. Wallet Scope Owner
changes reset intent directly, additional-address-only changes preserve it, and
matching workflow facts reset mounted intent to a post-initialization baseline.
Market Position derives fresh action defaults from the mounted route without
pre-navigation staging or retained owner-and-action attempt families.
Application composition owns projection lifecycle, without direct registry
access in either journey.

Application deep-link routing is one scoped Effect coordinator. Its route-edge
Atom supplies a normalized observation Stream; the coordinator owns serialized
claims, current Wallet revalidation, Flow start, and navigation. Claims commit
only after the accepted operation succeeds, so a failure remains eligible on
the next meaningful observation. The application composition owns the single
lifecycle mount; feature code does not manually mount or subscribe to command
Atoms.

Wallet logout is one semantic Wallet operation with single-flight execution:
concurrent callers share the in-flight result, while a later retry starts a new
attempt. Disconnect is the gate, explicitly owned storage cleanup is awaited,
and modal close finalizes every post-disconnect cleanup attempt. The default
storage cleanup capability is a no-op until a database is demonstrably
widget-owned; the widget never enumerates and deletes every database belonging
to the embedding origin.

Widget Persistence owns coherent ToS acknowledgement state. It serializes the
initial versioned read with acknowledgement writes, publishes Loading,
Available, or typed Failed state, and preserves the existing storage key. The
Preferences Atom only observes that state and forwards Acknowledge.

Position Details owns deterministic Exit and Pending Action decisions. Its Atom
adapter performs one local presentation transition or one public Classic Flow
Start tail delegation. Pending Action modal attempts have opaque identities,
and only a Started receipt for the same attempt closes the modal; the feature
does not import the private Classic orchestration service.

Exit and Pending Action each own their Atom implementation. Position Details
does not route either interface through a shared runtime pass-through file.

The current Yield Entry deepening changes only Position Details' Dashboard
Stake adapter and removes Classic Transaction Flow's reverse route dependency.

`features/yield-entry` owns the shared Yield Entry capability used by Earn and
position details. Concept-owned pure Earn rules, including amount constraints,
live in `domain/earn`; Yield Entry owns validation, CTA and submission
decisions, Enter Action Command preparation, and entry-specific formatted
projections. Its private
wallet-runtime service owns serialized wallet-connect and delegates Ledger
account setup to the wallet-owned semantic service, while its Atom facade owns validation-attempt presentation state and
tail-delegates an eligible Enter Action Command to Classic Transaction Flow.
The Atom facade, rather than a second Effect service, owns reactive composition.
It resolves current Wallet state, Wallet Scope and command identity, relevant
Widget Configuration, the current Yield KYC gate and refresh, and the Yield
Summary provider projection. Consumers supply only their Entry Intent,
available amount, whether the selected yield already has an active position,
mount identity, validation identity, an explicit Preserve Intent or Default to
Minimum amount-initialization policy, and one closed Yield Entry Readiness
projection: Loading, Empty, Ineligible, Refreshing, or Ready. They do not pass
the full Positions Data or independent loading, empty, fetching, and eligibility
booleans for Yield Entry to reinterpret. Refreshing preserves the current
presentation while disabling submission.
Yield Entry Readiness governs submission availability only. Infrastructure
failures, retry eligibility, and diagnostics remain in their authoritative
Resource or page projections rather than being folded into `Ineligible`.
`features/yield-summary` owns shared read-only yield projections such as
provider details, reward-token details, semantic yield type, and their shared
KYC, reward, provider, risk, and metadata presentation. Earn,
position details, transaction flows, activity, and portfolio consume these
modules through narrow public entries rather than importing implementation
from one another.

Service ownership is reviewed independently of the Feature and Resource Module
collections. The host-facing External Provider contract is owned by
`public-api`; `services/config` validates that contract and
`services/wallet` owns its executable wallet adapter. This keeps Config from
depending on Wallet and leaves the service dependency direction as Wallet to
Tracking to Config. Service directories are not declared owned Modules merely
to make that review mechanically uniform.

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

`WidgetConfigService` owns Widget Configuration; Effect atoms expose its
read-only reactive projection. Effect atoms own feature workflow state, shared
read models, and application lifecycle state. React Context is reserved for
values whose meaning is the React subtree itself or for libraries that require
their own provider.

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
- `RootElementContext` exposes the widget host element to portal and overlay
  descendants in that host subtree.
- `WidgetPresentationContext` supplies the host-owned rendering environment —
  overlay portal element, theme variant, icon overrides, input auto-resize — to
  the `shared/ui` kit. It is the inversion that lets shared components render
  host preferences without importing application configuration machinery. Its
  value is projected from current Widget Configuration and it is installed at
  the application composition seam.

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
  Complete journey and its Flow Session. Its `composition.ts` entry publishes one route
  module that owns the relative phase paths, intake guard, Review and Execution
  scope topology, and pages for each Classic journey mount. The app chooses the
  Classic or Dashboard shell, parent mount path, and app-level guards.
- `features/borrow` contains peer Borrow Entry and Market Position journeys.
  Its `composition.ts` entry publishes one route factory for each; the journeys may depend on
  supporting Borrow modules but never import each other.
- `features/borrow-transaction-flow` owns the Borrow Review, Steps, and Complete
  journey and its Flow Session. Each Borrow journey starts it through immutable
  entry-specific intake and observes only matching read-only lifecycle
  outcomes; the flow never imports the Borrow feature.
- `services/transaction-workflow` owns the shared execution-mechanics module.
  `TransactionWorkflowService.make` creates one fresh scoped workflow handle
  per immutable Transaction Workflow Input; the enclosing Classic or Borrow
  Execution scope owns its lifetime, and retained commands cannot revive it
  after that scope exits.

The shared Transaction Workflow contains execution mechanics only. Journey
projection, navigation decisions, handoff cleanup, and completion behavior
remain in the Classic and Borrow modules; application-owned destinations are
executed through the application-runtime `WidgetNavigation` module.
