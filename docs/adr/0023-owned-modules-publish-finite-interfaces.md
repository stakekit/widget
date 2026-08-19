---
status: accepted
---

# Owned modules publish finite interfaces

Production dependencies are default-deny across the App, Feature, Resource,
Service, Domain, Shared, Generated, and Public API layers. Repeated ownership
areas are declared as Module Collections rather than enumerating each Module.
Every Module discovered within a collection keeps its implementation private
and publishes only the interfaces permitted for its Module Kind.

A Feature Module may publish `index.ts` for its non-rendering interface,
`composition.ts` for routes and application composition, `views.ts` for
rendered elements and rendering-only hooks reused outside the Module, and `runtime.ts` for runtime
assembly. These interfaces are optional and exist only for real consumers. A
Resource Module publishes a required `index.ts` and no other interface kind.
The headless Widget Configuration Feature owns the reactive projection of
normalized configuration, including its read Atoms, update command Atom,
bootstrap snapshot Atom, and keyed React adapter hook; `services/config`
continues to own normalization and the Effect service. The API Service Module
publishes audience-specific `resource-sources.ts`, `operations.ts`, and
`runtime.ts` interfaces while keeping transport and generated clients private.
It is a singular Module rather than the first member of an inferred Service
Module Collection; other service directories require their own interface
design before receiving Module semantics. Capability interfaces expose only
Effect Tags and contracts, not Layer constructors. The runtime interface
publishes one composed API Layer rather than exposing transport or individual
capability assembly. The API Module publishes no general `index.ts`:
Resource implementations consume `resource-sources.ts`, Feature orchestration
and Transaction Workflow internals consume `operations.ts`, and application
runtime assembly consumes `runtime.ts`. Runtime environment types required by
application runtime code also come from `runtime.ts` rather than widening the
capability-interface audiences. Capability Tags are declared at their audience
interface seam; private implementation modules provide them.

Geoblocking is a separate flat capability at `services/geoblocking.ts`, observed
by API transport and consumed by Preferences; it is not a general Geolocation
provider, part of the API Module interface, or an implied member of a Service
Module Collection. Rich-error
presentation belongs to the Errors service; the API Module owns only its
transport, validation, and decoding failures.
Nested Modules follow the same convention: an enclosing Module consumes their
interfaces and publishes its own facade or composer rather than deep-importing
or transitively re-exporting child-owned symbols.

Inside its owning Module, implementation imports implementation directly and
does not route through its own interface. The API runtime is the deliberate
composition case: it imports its own interface Tags to provide them from
private implementations. Outside the owner, value, type-only, and dynamic
dependencies must use an allowed interface. Interfaces contain
only explicit named definitions or re-exports, never `export *` or namespace
wildcards, and they do not re-export symbols owned by another Module. Outbound
package entrypoints are the deliberate aggregation exception.

Tests may deep-import implementation while Knip's production analysis prevents
tests from keeping otherwise-unused production files or symbols alive.
Vanilla-extract style modules may deep-import another Module's style
implementation only when both modules are `*.css.ts`. Other exceptions are exact, named
importer-to-target relationships with a rationale; temporary exceptions also
state their removal condition. Capability-interface audiences are stable
architectural roles rather than lists of current caller files. The finalized
policy has no manual importer-to-target exceptions. Cross-Feature composition is performed by
the application: application composition injects the Transaction Flow and
Wallet route collaborators into Borrow composition rather than granting Borrow
a direct peer-composition exception. The same rule applies when shell chrome
needs a peer Feature's semantic projection: application composition supplies
the projection, while neither Feature imports the other. Reusable rendered
elements belong to the narrowest existing concept owner: generic structures in
`shared/ui`, shared yield read presentation in Yield Summary, and Yield Entry
interaction presentation in Yield Entry. A new horizontal presentation Module
is not introduced merely to relocate a cyclic dependency. Semantic judgments that cannot be derived
reliably from paths and import relationships remain review rules rather than
fragile automated checks.

The widget-owned TypeScript dependency-cruiser configuration contains typed
architectural declarations and privately compiles them into rules; callers do
not configure ownership through dependency-cruiser-shaped regular expressions.
Dependency-cruiser checks production `src` dependencies and exclusively owns
dependency direction, Module privacy, interface audiences, generated
runtime-client privacy, cycles, and resolution. Cycles are forbidden both
between concrete source files and between declared owned Modules after their
implementation files are collapsed to Module ownership; file-level acyclicity
alone is insufficient because mutually dependent Modules cannot be changed or
replaced independently. Biome owns React restrictions
and permitted barrel locations, while ast-grep owns explicit interface-export
syntax. Knip's ordinary and production modes own unused files, exports, types,
packages, and production reachability through tests. A Resource Module's
required `index.ts` remains a documented interface contract: external deep
imports fail dependency-cruiser and unreachable implementations fail Knip,
without a separate file-presence checker. Hygiene does not validate whether one
enforcement tool's configuration mirrors another's. Rev-dep and its overlapping
configuration were removed after the replacement covered the existing policy
and the migrated graph passed.

The cutover deliberately uses the acceptance criterion's documented-new-defect
exception rather than its 20% performance target. On the pre-migration tree,
rev-dep plus the test-only-export check took 2.47 seconds and about 384 MB peak
RSS. The replacement took 11.00 seconds and about 1.20 GB on its initial run,
and 8.28 seconds and about 1.31 GB warm. The added cost buys generic future-Module and
nested-Module privacy, required Resource interfaces, importer-specific
interfaces, self-interface and cross-Module re-export checks, wildcard-export
checks, type-only and dynamic edge coverage, and Knip's production reachability
analysis. These are defect classes the former configuration did not
cover generically. The separate production-reachability comparison preserves
the former test-only-export guarantee. Detailed measurements and findings are
recorded in the research note.

The migration was behavior-preserving: Feature and Resource interfaces moved
together with their enforcement, without changing ownership or runtime
behavior. This resolves ADR-0020's deferral of a repository-wide public/private
Module convention and generic internal-import checker.

The enforcement simplification was atomic: TypeScript replaced JavaScript for
the policy and its checks, all production imports moved with their new owners,
and obsolete paths were deleted without forwarding interfaces. The production
dependency scan no longer caches imported policy code because
dependency-cruiser's cache did not invalidate when that TypeScript policy
changed. Correct policy evaluation takes precedence over that unsafe cache.
The completed warm hygiene suite measured 8.44 seconds and about 1.26 GB peak
RSS, within the previously finalized 8.28-second and 1.31-GB result. Improvement
toward the former runtime remains desirable, but the obsolete 20% gate is not
restored while Knip intentionally performs broader analysis.

Module-level cycle enforcement consumes dependency-cruiser's resolved graph
and the same typed Module Collection declarations rather than introducing a
second ownership configuration or restoring rev-dep. During the cycle-removal
migration, every declared Feature, nested Feature, Resource, and singular owned
Module is a node, with the most-specific nested owner taking precedence and
intra-Module edges ignored. Only the exact directed edges in the existing cyclic
components are baselined, each with an explicit removal condition; component
membership alone is not a valid baseline. The baseline is removed edge by edge
as the behavior-preserving vertical slices land. Each slice runs its targeted
unit, DOM, and relevant browser tests plus widget lint and root hygiene,
followed by the full repository check when the final baseline is removed.
Cycle failures report both the owned-Module path and the contributing concrete
file imports. The migration is complete only when the graph has no owned-Module
strongly connected components and no temporary baselines remain.

The subsequent Service ownership review keeps service directories outside an
inferred Module Collection until each has a deliberate interface design. The
first seam separates the host-facing External Provider contract from its Wallet
adapter: `public-api` owns the snapshot type and capability predicates, Config
validates that neutral contract, and Wallet owns the executable adapter. This
removes Config's reverse dependency on Wallet; the remaining dependency
direction is Wallet to Tracking to Config.

The enforcement was subsequently simplified around its two graph-analysis
owners. The dependency-cruiser configuration, Knip configuration, commands,
and tool dependencies moved into `@stakekit/widget`; the repository root retains
only a Turbo-filtered command. The separate Module-interface source checker,
test-only Knip comparison script, architecture fixtures, and dedicated policy
TypeScript project were deleted. Native Knip production mode preserves
production reachability, ast-grep preserves explicit interface exports, and the
widget's normal TypeScript check covers its dependency-cruiser configuration.
