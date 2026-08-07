# Authoritative Resources for Shared Remote Data

Status: ready-for-agent

## Problem Statement

Remote API reads are currently owned by feature-local atoms and broad backend services. Equivalent requests to the same endpoint are represented by different atoms in Earn, Portfolio, Activity, Borrow, and widget-shell code, so the widget can fetch the same canonical fact more than once, apply different freshness policies to it, decode it into incompatible feature shapes, and invalidate only some of its consumers. The current layout makes the feature that happens to issue a request look like the owner of remote data that is actually shared across the application.

The duplication is already visible in yield details, yield listings, aggregate yield positions, token-balance scans, and validator pagination. Some duplicates call the same endpoint under different names; others differ only because a feature immediately projects the response into its own view model. This fragments the cache and obscures correctness problems. Selection-specific filtering can remove historical positions from portfolio totals, category availability checks can repeat equivalent bounded requests, and identical data may use different stale times depending on which feature requested it.

The backend abstraction is also too broad. Yield, Legacy, and Borrow services currently expose large generated-client-shaped surfaces to application code. That permits features to bypass a shared cache owner, makes dependency boundaries difficult to enforce, and couples callers to transport concerns and unrelated endpoint families. Simply moving all API atoms into one global module would centralize filenames without establishing coherent ownership; it would create a shallow registry with broad dependencies and no semantic boundary between cacheable facts and state-changing operations.

The widget needs one authoritative owner for every cacheable canonical remote fact, shared across all consuming features and scoped to one Widget Instance. That owner must define request identity, decoding, freshness, retry, pagination, concurrency, stale-result suppression, failure normalization, and invalidation. Features should bind current UI state to explicit resource inputs and derive feature views, while commands and multi-step workflows remain with the feature or workflow that owns the user intent. Backend access must be split into narrow read and operation capabilities so dependency rules can prevent feature code from reaching generated clients or transport infrastructure directly.

## Solution

Introduce a top-level Resources architectural tier composed of separate named deep modules. Each Authoritative Resource is the sole owner of one cacheable canonical remote fact and exposes a small typed Effect Atom interface. Equivalent requests made anywhere in the widget resolve to the same resource identity and therefore share acquisition, cache state, refresh work, and failures within the current Widget Instance registry.

Resources accept complete explicit inputs and never read feature state, selected state, current wallet state, or route state. They cache canonical decoded facts rather than transport DTOs or feature-shaped read models. Features bind concepts such as current wallet, selected yield, visible items, and route-specific filters to resource inputs, then project the canonical result for presentation without starting a second fetch.

The Resources tier owns cacheable reads only. User operations remain command atoms or workflow modules in the feature that owns the intent. Successful operations publish semantic invalidation events so every affected query variant becomes coherent. Direct refresh is reserved for user refresh and retry behavior. Pagination, request chunking, concurrency, stale-while-revalidate behavior, retry policy, and typed failure normalization stay behind each resource interface.

Replace the broad Yield, Legacy, and Borrow backend service surfaces with coarse capability ports. Yield and Borrow each expose a read source and an operations capability. Legacy currently exposes a read source only because its POST-based scans are semantically queries. One shared backend layer may implement both capabilities for a backend, but each capability has its own importable service contract. Generated clients and the transport service remain private adapter infrastructure.

Enforce the dependency direction from application composition through features, Resources, application runtime, capability services, and domain/shared foundations. Features may consume Authoritative Resources and operation capabilities, but may not import read-source capabilities, generated clients, or transport infrastructure. Resources may consume read-source capabilities but may not depend on feature state. Migrate in resource-sized vertical slices, deleting temporary adapters and duplicate fetch owners as each slice lands, then remove the broad backend services and enable the final strict dependency rules.

## User Stories

1. As a widget user, I want two screens requesting the same yield fact to share one fetch, so navigation and simultaneous rendering do not produce duplicate network work.
2. As a widget user, I want equivalent yield-list requests from different features to observe the same cached result, so Earn and Portfolio do not disagree because they refreshed independently.
3. As a widget user, I want aggregate yield positions requested by Earn and Portfolio to come from one authority, so balances and totals stay coherent.
4. As a widget user, I want token-balance scans requested by different features to share the same canonical result, so my wallet is not scanned repeatedly for the same scope.
5. As a widget user, I want validator lists to load on demand and equivalent screens to share their acquired progress, so opening a validator picker does not eagerly fetch the complete directory or duplicate page requests.
6. As a widget user, I want each available category checked with one shared request using the API maximum page size, so category discovery preserves the established bounded behavior without scanning the complete Yield catalog.
7. As a widget user, I want historical positions included in portfolio totals even when their yields are not currently selected or visible, so presentation filtering cannot corrupt accounting.
8. As a widget user, I want switching between Earn and Portfolio to reuse fresh data, so the widget feels responsive and avoids unnecessary loading states.
9. As a widget user, I want a stale cached value to remain usable according to one resource policy while revalidation occurs, so every consumer has consistent refresh behavior.
10. As a widget user, I want retrying a failed resource to refresh the shared authority, so all consumers recover together.
11. As a widget user, I want a manual refresh to update the shared resource, so I do not need to refresh the same fact separately on every screen.
12. As a widget user, I want an operation that changes positions to invalidate every relevant position query, so no screen continues displaying a cached pre-operation position.
13. As a widget user, I want an operation that changes balances to invalidate every relevant balance query, so dependent screens become coherent after the operation.
14. As a widget user, I want activity-producing operations to invalidate relevant activity resources, so new history appears without unrelated cache resets.
15. As a widget user, I want borrow operations to invalidate affected borrow positions and markets, so Borrow screens do not retain stale command results.
16. As a widget user, I want semantic invalidation to cover all query variants affected by a change, so a differently filtered or paginated view cannot remain stale.
17. As a widget user, I want an empty collection of requested identifiers to complete without network I/O, so empty UI states do not trigger meaningless requests.
18. As a widget user, I want requests containing repeated identifiers to avoid duplicate backend work, so enrichment and bulk loading are efficient.
19. As a widget user, I want a partial or missing identifier result represented explicitly, so missing remote facts are not mistaken for empty or successful data.
20. As a widget user, I want transport failures, decode failures, and violated response invariants distinguished, so the UI can present appropriate retry and error behavior.
21. As a widget user, I want a slower obsolete request unable to overwrite a newer result, so rapid wallet, network, or filter changes cannot publish stale data.
22. As a widget user, I want changing wallet or network identity to produce a different resource request, so cached data from one scope is never shown in another.
23. As a widget user, I want semantically equivalent input ordering to share a request where ordering is irrelevant, so harmless collection order changes do not fragment the cache.
24. As a widget user, I want semantically distinct requests to remain separate, so canonicalization never merges inputs that can produce different results.
25. As a widget user, I want large requests to be chunked or paginated behind the resource boundary, so transport limits do not leak into feature behavior.
26. As a widget user, I want a full-result resource to publish success only after its hidden pagination policy is satisfied, so callers do not accidentally treat a partial page as the complete fact.
27. As a widget user, I want a product-defined load-more experience to expose semantic continuation rather than raw transport page mechanics, so pagination behavior matches the UI intent.
28. As a widget user, I want provider enrichment to deduplicate provider lookups, so a list with many yields from one provider does not repeat the same work.
29. As a widget user, I want provider-enrichment failure behavior to be consistent and explicit, so one auxiliary failure cannot unpredictably change the whole catalog result.
30. As a widget user, I want prices, histories, rewards, KYC facts, and health data to follow the same ownership rules, so resource behavior is predictable beyond yields.
31. As a widget user, I want Activity reads to have one authoritative cache owner, so history summaries and detail surfaces do not independently fetch the same records.
32. As a widget user, I want Borrow catalog and position reads to share canonical resources, so distinct Borrow views do not create parallel caches.
33. As a widget user, I want remounting the widget after unmount to start with a fresh resource registry, so data and in-flight work from an old Widget Instance cannot leak into the new one.
34. As a widget user, I want unmounting the widget to interrupt or release resource work owned by that instance, so obsolete requests cannot continue publishing application state.
35. As a widget host, I want the public React component API to remain compatible, so this internal architecture change does not require integration changes.
36. As a widget host, I want the bundled renderer API to remain compatible, so CDN and imperative integrations continue to work.
37. As a feature developer, I want to request a named domain resource rather than choose an API method, stale time, retry count, or page size, so remote-data policy has one owner.
38. As a feature developer, I want resource inputs to be explicit and complete, so a resource can be understood and tested without hidden access to feature or wallet state.
39. As a feature developer, I want current-wallet and selected-yield binding to remain in the feature layer, so shared resources are reusable and do not import UI context.
40. As a feature developer, I want to derive view-specific models from canonical resource facts without creating another fetch atom, so presentation remains flexible without fragmenting the cache.
41. As a feature developer, I want read-only resource state exposed to React, so view code cannot mutate canonical storage or coordinate asynchronous fetching.
42. As a feature developer, I want command atoms to dispatch user intent and publish semantic invalidation after successful operations, so workflows remain near their domain behavior.
43. As a feature developer, I want simple operations to call an operation capability directly from their owning command atom, so the architecture does not require shallow pass-through workflow modules.
44. As a feature developer, I want complex operations to live in deep intent-owning workflow modules when they coordinate multiple steps, retries, state transitions, or cleanup, so that complexity is hidden behind a narrow command surface.
45. As a feature developer, I want Legacy POST scans treated as cacheable reads when they do not change server state, so HTTP verbs do not determine architectural ownership.
46. As a feature developer, I want Yield, Legacy, and Borrow read access represented by separate named capabilities, so a feature cannot receive an entire backend client merely to read one fact.
47. As a feature developer, I want Yield and Borrow operations represented separately from their read sources, so command access does not also grant cache-bypassing read access.
48. As a maintainer, I want every cacheable canonical remote fact to have exactly one Authoritative Resource, so ownership can be located without tracing feature-local fetches.
49. As a maintainer, I want Resources to be a tier of named modules rather than one global API atom registry, so each module remains deep, cohesive, and independently testable.
50. As a maintainer, I want exact semantic request sharing to be the default, so deduplication is correct without requiring a risky global normalized entity store.
51. As a maintainer, I want cross-request entity normalization enabled only for a resource whose merge semantics and identity invariants are explicitly proven, so partial responses cannot corrupt canonical facts.
52. As a maintainer, I want canonical decoded domain facts cached instead of generated transport DTOs, so transport schema changes have one adaptation seam.
53. As a maintainer, I want feature-shaped projections excluded from canonical storage, so one feature cannot silently redefine the data observed by another.
54. As a maintainer, I want each Authoritative Resource to normalize failures into a stable typed vocabulary, so raw generated-client and transport errors do not escape into features.
55. As a maintainer, I want freshness, polling, retry, concurrency, pagination, and stale-result policy owned by the resource, so callers cannot create divergent behavior for the same fact.
56. As a maintainer, I want cache state to use the existing Widget Instance Atom registry, so no module-global cache or ad hoc runtime undermines lifecycle and invalidation.
57. As a maintainer, I want generated backend clients hidden behind adapters, so application modules do not depend on generated client organization or transport details.
58. As a maintainer, I want the transport service to remain the single private owner of base URLs, API credentials, headers, retries, geo-block handling, and rich transport errors, so the refactor does not duplicate infrastructure.
59. As a maintainer, I want one implementation layer to be able to provide both read and operation capabilities for a backend, so capability separation does not require duplicate client construction.
60. As a maintainer, I want the broad Yield, Legacy, and Borrow API service interfaces removed after migration, so there is no permanent escape hatch around Authoritative Resources.
61. As a maintainer, I want dependency rules to reject feature imports of read sources, generated clients, and transport infrastructure, so cache ownership is mechanically enforced.
62. As a maintainer, I want dependency rules to reject Resource imports of feature state, so resources cannot gain hidden current-selection or current-wallet dependencies.
63. As a maintainer, I want operation capabilities available only to command and workflow owners that need them, so read-only view code cannot mutate remote state.
64. As a maintainer, I want reverse-dependency and hygiene checks to detect forbidden imports in continuous validation, so architectural erosion fails early.
65. As a maintainer, I want migration to proceed one resource-sized vertical slice at a time, so behavior can be proven and duplicate owners deleted incrementally.
66. As a maintainer, I want temporary adapters deleted inside the slice that introduces them, so the codebase never settles into permanent dual fetching or two authorities.
67. As a maintainer, I want each migrated resource to replace its old atoms and callers completely before the next slice depends on it, so cache behavior remains comprehensible during the transition.
68. As a maintainer, I want the clearest duplicated resources migrated first, so the architecture is validated against real shared-cache problems before lower-value endpoints move.
69. As a maintainer, I want the final dependency restriction enabled only after the legacy broad services are removed, so the migration can remain buildable without weakening the end-state rule.
70. As a test author, I want an Authoritative Resource's public contract to be the primary behavioral seam, so tests remain stable if pagination, caching, or adapter internals change.
71. As a test author, I want controllable in-memory read-source capabilities beneath resource tests, so request sharing, freshness, interruption, and failure behavior can be verified deterministically.
72. As a test author, I want backend adapter tests below the resource seam, so generated-client request mapping and transport error conversion are covered without duplicating resource behavior tests.
73. As an AI coding agent, I want named resources, explicit inputs, narrow capabilities, and enforced dependencies, so ownership and allowed change surfaces are discoverable from the module graph.
74. As a reviewer, I want a resource migration to show removal of duplicate fetch paths and broad-service imports, so centralization is demonstrated by deletion rather than only by adding a new abstraction.

## Implementation Decisions

### Resource ownership and vocabulary

- An Authoritative Resource is the sole owner of one cacheable canonical remote fact. The term is architectural vocabulary and does not introduce a new product-domain concept.
- The Resources tier is a collection of separate named deep modules, not a single global registry API, generic endpoint wrapper, or file containing all atoms.
- Resource boundaries follow semantic facts rather than backend endpoint grouping or consuming feature structure. A resource may serve multiple features, and one feature may compose several resources.
- A backend endpoint may support several Authoritative Resources when consumers require different semantic contracts, such as demand-driven Pull, complete collection, bounded summary, or point lookup. Sharing is mandatory within an equivalent semantic contract, not across contracts with different completeness or continuation guarantees.
- Exact semantic request sharing is mandatory. Two calls that represent the same complete request identity use the same Effect Atom resource and share acquisition, cached state, revalidation, and failure state inside one Widget Instance.
- Cross-request entity normalization is opt-in per resource. It requires documented stable identity, field completeness, merge semantics, invalidation behavior, and evidence that combining responses cannot create a fact the backend never returned.
- Resources cache canonical decoded facts. Generated transport DTOs are adapted at the backend boundary, while feature-specific filtering, grouping, totals, selection, visibility, and presentation models remain downstream projections.
- Every resource exposes a named typed interface. Do not introduce a generic resource registry in which callers provide endpoint names, fetch functions, page policy, arbitrary cache keys, or retry options.
- A resource's internal mutable cache storage remains private. Consumers receive read-only state and narrowly defined refresh or retry commands where product behavior requires them.

### Inputs, keys, and cache identity

- Resource inputs contain the complete identity of the remote fact, including all wallet, network, protocol, yield, token, locale, filter, sort, and other request dimensions that can alter the result.
- Resources never read current Wallet Scope, route state, feature atoms, selected yield, visible collections, or configuration implicitly. Features snapshot or bind those values into explicit typed resource inputs.
- Key canonicalization is semantic and resource-specific. Irrelevant collection ordering and duplicate identifiers may be normalized; meaningful ordering, multiplicity, absence, default values, and filter distinctions must remain part of identity when they affect the response.
- Empty identifier collections and other semantically empty requests are handled before adapter I/O and return the resource-defined empty fact.
- Cache keys must not depend on unstable object identity, generated-client instances, timestamps, or caller-chosen cache labels.
- Cache state, request sharing, and in-flight fibers are scoped to the existing Atom registry owned by one Widget Instance. No module-global caches, Promise maps, secondary Atom registries, or ad hoc Effect runtimes are introduced.
- Sequential Widget unmount and remount creates fresh resource state. The design does not attempt to share caches between separate Widget Instances or browser documents.

### Resource policy and failures

- Each Authoritative Resource owns freshness duration, stale-while-revalidate behavior, polling eligibility and cadence, retry eligibility and backoff, request concurrency, chunking, pagination, stale-result suppression, and disposal behavior.
- Callers cannot override resource policy. A genuinely different product contract is modeled as a distinct semantic resource or a named operation on the same resource, not as caller-provided transport settings.
- Resources hide transport pagination. A remotely paginated product list defaults to demand-driven semantic Pull behavior, while a bounded canonical collection returns the complete applicable result only when a consumer explicitly requires completeness. Bounded summaries and point lookups remain separate contracts rather than scanning a complete collection.
- Demand-driven resources use one memoized Pull Atom per semantic query so equivalent consumers share acquisition and accumulated progress. A feature facade may map, filter, enrich, or otherwise project the Pull result, but it must forward the resource's Pull and Refresh commands instead of creating a second pagination stream.
- Pull resources rely on native Atom and Stream semantics for continuation, accumulation, waiting, failure, disposal, and refresh. Continuation is derived only from the backend response's offset, limit, and total. Refresh reconstructs the stream from its first page, and a later-page failure retains already accumulated values according to native Pull behavior.
- Repeated Pull while a request is waiting is prevented by the UI's published waiting state. Resources do not introduce private page caches, manual offset state, request locks, replay buffers, or custom refresh generations to coordinate pagination.
- Bulk and enrichment resources deduplicate identifiers and share repeated subrequests where semantics permit it. Provider enrichment explicitly defines whether auxiliary failures fail the whole fact, produce typed partial data, or use a documented fallback.
- Resource acquisition maps request, transport, decode, and invariant failures into stable typed resource failures. Raw generated-client exceptions and transport DTO error unions do not cross the resource interface.
- Missing requested entities are modeled explicitly according to the resource contract. They are not silently dropped when dropping them would make a partial response appear complete.
- Refresh generations, interruption, or equivalent Atom resource semantics prevent results from obsolete inputs or disposed scopes from replacing newer state.
- Retry repeats the resource-owned acquisition policy. User refresh and retry may trigger direct refresh; ordinary command completion uses semantic invalidation instead.

### Commands, operations, and invalidation

- The Resources tier owns cacheable reads only. It does not own transactions, mutation workflows, signing, submissions, multi-step commands, or user-intent state machines.
- A feature's command atom may call an operation capability when the action is simple and the atom already forms a deep intent boundary. Do not add a pass-through command module that only renames one operation call.
- A dedicated operation or workflow module is introduced when it hides meaningful coordination such as multiple backend calls, wallet interaction, retries, concurrency, state transitions, compensation, or scoped cleanup.
- Successful operations publish semantic invalidation events such as wallet balances changed, yield positions changed, activity changed, borrow positions changed, or borrow markets changed. Events describe changed facts rather than naming cache keys or feature screens.
- Each Authoritative Resource declares which semantic invalidations affect it and refreshes or marks stale every relevant query variant. Operation modules do not enumerate individual cached request keys.
- Semantic invalidation is the normal cross-module coherence mechanism. It can invalidate resources not currently mounted without forcing an immediate fetch; active resource policy determines revalidation timing.
- Direct refresh remains available only where a user explicitly refreshes or retries a resource. Features do not use direct refresh as a substitute for publishing the semantic effects of a command.

### Backend capabilities and dependency boundaries

- Replace broad backend services with coarse capability ports: `YieldResourceSource`, `YieldOperations`, `LegacyResourceSource`, `BorrowResourceSource`, and `BorrowOperations`.
- Read-source capabilities contain backend access needed to acquire canonical facts. Operation capabilities contain state-changing calls. They use distinct service contracts and import paths even when one shared implementation layer constructs and provides both.
- Legacy exposes no operations capability until it has a genuine state-changing use case. A POST request used for token scanning remains part of `LegacyResourceSource` because query versus command is determined by semantics, not HTTP method.
- Resource modules may depend on the corresponding read-source capability. Features, view adapters, and workflows do not import read-source capabilities directly.
- Feature command atoms and intent-owning workflow modules may depend on operation capabilities. Read-only resource modules do not depend on operation capabilities.
- Generated Yield, Legacy, and Borrow clients remain private implementation details of backend adapters. They are not imported by Resources, features, React views, or domain modules.
- The transport service remains private infrastructure responsible for client construction, base URLs, credentials, common headers, retry behavior, geo-block recognition, and transport-level error detail.
- Broad `YieldApiService`, `LegacyApiService`, and `BorrowApiService` contracts are removed after their callers migrate. No compatibility facade remains that exposes the full generated-client-shaped surface internally.
- The public widget component and bundled renderer remain compatible. Removing broad backend services is an internal architecture change and does not remove or rename the package's public bundle entry.
- The mechanically enforced dependency direction is application composition to features to Resources to application runtime to services to domain/shared foundations, with narrow exceptions for established foundational dependencies that do not bypass resource ownership.
- Boundary checks prohibit features from importing read sources, generated clients, or transport infrastructure; prohibit Resources from importing features or React; and prohibit application logic from using React-owned fetching.
- Operation-capability access is permitted only from owning command or workflow modules. The rule should be encoded with module-boundary and restricted-import checks rather than relying on filename convention or review memory alone.

### Initial resource boundaries

- Yield detail and initial-yield lookups become one authoritative semantic resource when their endpoint and identity are equivalent. Caller-specific initialization behavior remains a feature projection or workflow concern.
- General yield listing, available-yield listing, and token-scope yield listing share the same canonical listing resource where they are endpoint-equivalent. Availability and token-scope views are derived or expressed as explicit semantic inputs rather than separate fetch owners.
- Yield positions become one canonical resource used by Earn and Portfolio. Selection and visibility filtering occur after canonical position accounting so historical positions cannot disappear from totals.
- Token-balance scanning becomes one canonical resource. Earn- and Portfolio-specific schemas become projections from one decoded fact rather than separate requests.
- Validator discovery has separate semantic contracts over the same endpoint: ordinary and search results use one shared demand-driven Pull per query; preferred validators use an explicit complete resource; and address resolution uses a bounded point resource. Search may advance independent name and address branches concurrently, then merge and deduplicate them deterministically.
- Yield Directory and provider data use named resources with explicit enrichment and failure semantics. The complete directory contract is bounded to explicit requested Yield IDs. Category discovery is a separate bounded-summary contract that issues one first-page request per category using the API maximum page size and checks eligible results from that response.
- Yield-backed token discovery uses a shared demand-driven Pull. Legacy token options remain a complete non-paginated resource and are projected as immediately complete when the product surface supports both sources.
- Activity history uses a shared demand-driven Pull that emits semantic batches containing actions and the backend total. Filter counts use bounded summary requests; neither path scans a complete history. Activity enrichment is a projection over the canonical Pull and does not create a second pagination stream.
- Prices, histories, KYC facts, rewards, and health data each receive a named owner as their slices migrate; they are not placed into a miscellaneous shared API module.
- Yield Directory remains an explicit complete resource for a bounded set of requested Yield IDs, and Borrow Markets remains complete because market-position resolution requires the full applicable set. No Yield resource scans the unfiltered complete catalog; category availability uses the bounded per-category summary contract.
- Borrow catalogs and positions otherwise receive named resources with complete identity and semantic invalidation from Borrow operations.

### Migration and delivery

- Migrate by complete vertical resource slices rather than converting every backend service in one change. Each slice introduces the Authoritative Resource, capability access, canonical model, tests, caller migrations, invalidation behavior, and deletion of all replaced fetch owners.
- The first slice covers yield positions and token balances because they have clear cross-feature duplicates and exercise explicit Wallet Scope, canonical models, semantic invalidation, and shared cache behavior.
- The second slice covers the Yield Directory, yield listings, categories, and provider enrichment. The third covers validators. The fourth covers Activity. The fifth covers prices, histories, KYC, rewards, and health. The sixth covers Borrow catalogs and positions.
- Within each slice, temporary adapters may delegate to existing infrastructure only while callers are being moved. They are deleted before the slice is considered complete; there is no permanent dual-fetch period or two cache authorities.
- A migrated caller must consume the resource or a zero-logic feature projection over it. It must not retain a fallback path to the broad backend service.
- Existing freshness and retry behavior is inventoried before choosing the canonical resource policy. Where feature policies conflict, the resource adopts one explicit semantic policy and tests make the behavior change visible.
- Existing results are audited for endpoint equivalence before atoms are merged. Similar names alone do not prove equivalent request identity or response semantics.
- The broad backend services are removed only after all of their reads and operations have moved to the relevant capability ports. The final strict import rule is enabled in the same concluding slice so no unrestricted service path remains.
- Architecture documentation and the accepted decision record remain aligned with the implementation as each slice lands.

## Testing Decisions

- The primary behavioral test seam is each named Authoritative Resource interface. Tests construct it inside a fresh Atom registry with controllable in-memory read-source capabilities and observe the same read-only state and commands available to feature consumers.
- This seam is preferred over testing internal atom helpers, cache maps, generated-client calls, or feature hooks because it protects the architectural contract while allowing pagination, canonicalization, and adapter internals to change.
- Backend adapter tests form a lower seam. They verify capability-to-generated-client request mapping, authentication and transport integration boundaries, DTO decoding inputs, and transport failure conversion without repeating cache-policy tests.
- Operation-capability and intent-module tests form a separate lower seam for commands. They verify operation request mapping, typed failures, multi-step coordination where present, and publication of semantic invalidations.
- A contract suite proves that two consumers making exactly equivalent requests receive one resource identity and cause one acquisition while the result is fresh.
- Equivalent-request tests cover separate feature projections, simultaneous subscriptions, sequential subscriptions, reordered set-like identifiers, duplicate identifiers, and normalized defaults that are semantically equal.
- Distinct-request tests cover every identity dimension that can alter a response, including wallet owner, network, yield, token set, filter, sort, locale, protocol, and pagination mode where applicable.
- Empty-input tests prove a semantic empty result and zero read-source calls.
- Key-stability tests prove that cache identity does not rely on object reference, caller name, timestamps, or generated-client identity.
- Canonicalization tests prove that only semantically irrelevant ordering and duplicates are normalized. Counterexamples prove meaningful ordering or multiplicity is not collapsed.
- Lifecycle tests prove cache sharing within one Widget Instance registry, interruption on disposal, no publication from an obsolete generation, no module-global retention, and a fresh cache after sequential unmount and remount.
- Freshness tests use controllable time to cover fresh reuse, stale publication, revalidation, expiry, polling eligibility, and resource-specific retry policy without real timers or network calls.
- Concurrency tests prove multiple subscribers share one in-flight acquisition, a newer generation wins over a slower obsolete request, cancellation does not corrupt a replacement request, and configured request concurrency limits are respected.
- Failure tests independently cover request construction, transport, decoding, invariant, missing-entity, and unsupported-input failures. They assert stable resource failure types and prove raw adapter exceptions do not escape.
- Retry tests prove retry eligibility is owned by the resource, non-retryable failures do not loop, a later-page failure preserves accumulated values, and explicit Retry or Refresh restarts the shared Pull from its first page.
- Manual-refresh tests prove user refresh uses the resource interface and cannot create a feature-local second fetch path.
- Complete-resource pagination tests cover zero pages, one page, multiple pages, backend page-size boundaries, ordering, deduplication, and publication only after the full canonical collection is acquired.
- Semantic Pull tests prove initial acquisition requests only the first backend page, each accepted Pull advances by one backend continuation, no page is fetched eagerly, equivalent consumers share one Pull identity and accumulated progress, waiting disables repeated Pull, and the interface does not leak raw generated-client pagination structures.
- Pagination continuation tests prove the next request is derived from the backend response's offset, limit, and total rather than the requested limit or decoded item count.
- Chunking tests cover empty chunks, exact transport-limit boundaries, multiple chunks, duplicate identifiers across chunks, stable result assembly, bounded concurrency, partial failure, missing IDs, and deterministic canonical ordering.
- Provider-enrichment tests cover no providers, one provider referenced repeatedly, many providers, deduplicated lookup, auxiliary failure policy, missing provider records, and preservation of the base canonical result according to the declared contract.
- Yield-detail tests prove endpoint-equivalent initial and ordinary lookups share one request while feature-specific initialization decisions remain outside the resource.
- Yield-list tests prove endpoint-equivalent catalog views share acquisition and that selection, availability, and token-scope projections do not create new fetches.
- Category tests prove discovery issues exactly one request per category with `offset: 0` and the API maximum page size, applies the category's Yield types, and derives visibility from eligible results in that bounded response.
- Position tests prove Earn and Portfolio share aggregate position acquisition, all historical positions remain available to accounting projections, and visible-yield filtering cannot alter canonical totals.
- Token-balance tests prove Earn and Portfolio share scanning for the same Wallet Scope and token request, while their differing view schemas are pure projections.
- Validator tests prove ordinary and search queries acquire one page per Pull and share progress across equivalent consumers, preferred validators explicitly acquire the complete result, address lookup remains bounded, and search merges its independently paginated name and address branches deterministically.
- Activity tests prove history acquires one backend page per Pull, exposes action batches with the backend total, uses bounded total requests for filter counts, never completes history merely to paginate in memory, and receives command invalidation without eagerly fetching inactive variants.
- Token-discovery tests prove the Yield source acquires one page per Pull while the Legacy source publishes its complete non-paginated list immediately and exposes no fake continuation.
- Borrow tests prove catalogs, markets, and positions share within their exact identities and respond to the appropriate Borrow operation invalidations.
- Semantic-invalidation tests publish each supported event and assert that every affected resource variant becomes stale or revalidates according to its policy, while unrelated resources remain fresh.
- Multi-variant invalidation tests include different filters, Wallet Scopes, networks, pages, and mounted/unmounted states so invalidation cannot accidentally target only the command caller's current view.
- Operation tests prove successful commands publish invalidation only after the remote operation succeeds, failed commands do not claim nonexistent changes, and repeated invalidation is safe.
- Feature integration tests mount representative Earn, Portfolio, Activity, and Borrow adapters against one registry and prove their projections share resource acquisition without importing read-source capabilities.
- React adapter tests prove views only render resource state and synchronously dispatch commands; they do not own fetching, retry loops, duplicated loading state, or raw error normalization.
- Dependency tests and hygiene checks prove features cannot import read sources, generated clients, or transport infrastructure; Resources cannot import features or React; and generated clients are reachable only from private adapters.
- Migration-slice tests include a search or dependency assertion that no replaced broad-service call or old fetch atom remains for the migrated fact.
- Selective-normalization tests are required only for resources that opt into cross-request entity normalization. They prove entity identity, completeness, merge order independence, invalidation, deletion, and partial-response behavior; absence of these proofs means the resource remains exact-request cached.
- Regression coverage preserves public React and bundled entry behavior, one concurrently mounted Widget Instance, sequential remount, existing routes, and existing feature presentation unless a slice explicitly changes a previously inconsistent cache policy.
- The validation ladder for each slice includes focused resource contract tests, adapter or operation tests when touched, affected feature integration tests, widget lint and type checking, and dependency-hygiene enforcement. Representative browser tests are added where cache sharing, navigation, polling, or lifecycle behavior cannot be proven at a lower seam.

## Out of Scope

- Building one global API atom module, generic endpoint registry, generic query builder, or caller-configurable cache framework.
- Introducing a normalized entity store across all endpoints without resource-specific identity and merge proofs.
- Sharing cache state across concurrently mounted Widget Instances, browser documents, users, or sequential application-runtime generations.
- Adding support for multiple concurrently mounted Widget Instances.
- Replacing the existing Atom registry or application Effect runtime with a new caching runtime.
- Introducing page-level cache atoms, manual offset or accumulation atoms, pagination locks, replay buffers, or custom refresh state machines for semantic Pull resources.
- Introducing React Query, hook-owned fetches, Promise caches, module-global maps, or React effects for resource acquisition.
- Moving transactions, signing, submissions, user-intent workflows, or command state machines into the Resources tier.
- Creating shallow operation modules that only forward one call without hiding coordination or policy.
- Changing backend endpoint contracts, generated SDK behavior, authentication, base URL selection, geo-block policy, or transport retry infrastructure except where needed to expose the agreed capability ports.
- Changing public package exports, the React component contract, the bundled renderer contract, routes, UI design, translations, or product copy.
- Guaranteeing that similarly named endpoints are equivalent without auditing their complete request and response semantics.
- Preserving conflicting feature-specific stale times merely for internal behavioral compatibility; each resource must choose and document one canonical policy.
- Performing the migration as an all-at-once rewrite or retaining permanent compatibility facades around the broad backend services.
- Adding Authoritative Resource to the product domain glossary; it remains implementation architecture terminology.

## Further Notes

- The centralization goal is ownership, not physical colocation. A discoverable Resources tier provides one place in the architecture to look, while separate named modules preserve cohesion and information hiding.
- “Route commands through deep intent-owning operation modules” means a user intent with meaningful orchestration is represented by a module that owns that orchestration and consumes an operation capability. It does not mean every generated-client method receives a same-shaped command wrapper.
- `YieldResourceSource` and `YieldOperations`, and their Legacy and Borrow counterparts, are Effect service contracts. They are capability seams below Resources and commands, not resource caches themselves.
- The transport service and generated clients still exist as private implementation machinery. What disappears is the ability for arbitrary application code to receive the full backend client surface.
- POST-based reads demonstrate why semantic ownership matters more than HTTP conventions: a scan that only retrieves facts belongs to a read source and may be cached by an Authoritative Resource.
- Exact-request sharing is the safe baseline. It delivers the primary benefit—one cache and one in-flight acquisition for equivalent calls—without creating the correctness risks of merging partial entities returned by different endpoints.
- Pagination mode is part of the semantic contract. Two consumers share acquisition and progress when they use the same Pull contract; a complete, summary, or point contract over the same endpoint remains distinct because it promises a different fact.
- Historical behavior is intentionally preserved where it represented product semantics: Activity history, Yield token discovery, and ordinary/search validators remain demand-driven; preferred validators and Borrow Markets remain complete; Yield Directory is complete only for explicit requested IDs; category discovery remains one bounded maximum-size request per category; and Legacy token options remain a complete non-paginated list.
- The staged order is intentionally front-loaded with duplicated Yield and Legacy reads. Those slices validate the architecture's hardest requirements: cross-feature sharing, explicit Wallet Scope, feature-independent canonical models, pagination, and semantic invalidation.
- A slice is complete only when the new resource is authoritative in practice: all intended callers use it, duplicate fetch owners are deleted, invalidation is wired, its capability boundary is tested, and forbidden direct imports cannot reappear.
