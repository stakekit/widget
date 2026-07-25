# Atom-owned feature facades, Yield Entry, and application navigation

Status: implemented

## Problem Statement

The Earn page currently concentrates a large amount of view-model and workflow logic in one React-owned model. That model subscribes to state, performs filtering, grouping, formatting, validation, request construction, pagination routing, CTA decisions, navigation, tracking, and third-party integration, then republishes the aggregate through a layout-effect-backed Atom for descendant consumers. Some values published by the underlying Earn state are themselves Atom identities or factories, so React must read one Atom to discover and subscribe to another. This Atom-to-React-to-Atom binding obscures ownership, causes broad subscriptions, and creates a second presentation-owned state machine alongside the existing Earn machine.

The same deterministic calculations and resource projections are packaged as React hooks and imported by position details, transaction review and completion, activity, and portfolio. Those consumers therefore depend backwards on Earn's React layer, and fixes to amount constraints, provider details, reward projections, KYC state, yield type, or Action Command construction remain distributed across hook call sites.

Application-owned navigation has a similar bridge. Classic and Borrow Transaction Flows and pending-action deep links publish Atom outcomes that React route adapters observe and convert into React Router navigation. This adds outcome-delivery state and lifecycle coordination even though the Widget Instance already owns an explicit memory router. Submission handlers in Earn and position details also combine workflow decisions, session start, analytics, and navigation inside React.

After moving navigation decisions into `WidgetNavigation`, router construction still crosses the boundary in the opposite direction. React creates and retains the memory router, wraps it in a forwarding adapter, seeds that adapter into the Atom registry, and the application runtime reads it back to construct its navigation Layer. This models a construction-time dependency as mutable reactive input, leaves router disposal implicit, and conflicts with React Router guidance that data routers be created outside the React tree.

The result is difficult to test at a stable interface, hard to navigate for maintainers and agents, and inconsistent with the established rule that Effect and Effect Atom own application logic. The architecture needs stable feature facades, shared Yield Entry and yield-summary capabilities, and a headless navigation seam without changing visible product behavior or public embedding interfaces.

## Solution

Replace callback-rich aggregate React models with capability-oriented feature facades. Each facade exposes stable read-only view Atoms and writable command Atoms while keeping mutable state, dynamic Authoritative Resource identities, pagination, retry routing, and command implementations private. React reads the smallest relevant capability and synchronously dispatches user intent. Public view values never contain nested Atoms, Atom factories, or callback functions.

Keep the existing Earn machine as the sole source of truth for Earn Selection, readiness, failure, and user intent. Build the Earn page facade as derived capabilities for token options, yield options, validators, amount and quote, rewards and providers, submission, validation, CTA state, and page failure. Move search normalization, filtering, grouping, validator request debounce, dynamic pagination routing, and loading projections into Atom state. Leave translation and genuinely local presentation state in React.

Introduce two cross-feature deep modules. `YieldSummary` owns read-only semantic projections such as provider details, reward-token details, yield type, and their normalized resource state. `YieldEntry` owns the pre-execution attempt to add tokens to an Earn Selection: amount constraints, validation, KYC projection, estimated rewards, Enter Action Command construction, submission eligibility, CTA decisions, command effects, analytics, transaction-session start, and navigation. Each feature supplies an input Atom and consumes the module's stable view and command interface, preserving the feature's own route or session lifetime.

Migrate every consumer of the legacy shared React hooks. Follow any required dependency upstream until it reaches an immutable route/session input, an existing feature Atom, or an Authoritative Resource; do not publish changing hook results into writable Atoms as a replacement bridge. Retain unrelated logic in surrounding features, but delete the migrated hooks and the Earn aggregate model once no callers remain.

Add `WidgetNavigation` to the application runtime. A separate synchronous base runtime constructs a scoped `ApplicationRouter` Layer around the existing memory router and provides its Effect Context to the application runtime, which constructs `WidgetNavigation` directly from that service. An internal Atom synchronously exposes the runtime-owned router only to the React composition boundary for `RouterProvider`. The router is disposed with its Application Runtime Generation, and a new API identity receives fresh memory history. Workflow commands and transition events execute canonical absolute destinations through `WidgetNavigation` after their ownership and stale-result checks. Declarative route guards, route reads used only for presentation, and view-local tabs, breadcrumbs, and back controls remain React concerns.

Keep one named React-only integration seam for RainbowKit modal commands. A provider adapter installs connect- and chain-modal commands into a runtime-scoped `WalletModal` interface and releases them with the provider lifetime. Feature state and commands do not carry modal callbacks. Remove the existing module-global latest-chain-modal callback mechanism.

The completed migration is behavior-preserving. Classic and dashboard Earn, position details, transaction flows, activity, portfolio, deep links, loading, pagination, retry, KYC, analytics, and routing retain their visible semantics. The final tree contains no compatibility aggregate page-model adapter and no dual ownership of the migrated behavior.

## User Stories

1. As a widget user, I want the Earn page to preserve its current selections and interactions, so an internal architecture change does not alter how I stake.
2. As a widget user, I want classic and dashboard Earn variants to show the same token, yield, validator, amount, and provider information as before, so the two experiences remain consistent.
3. As a widget user, I want token searching to filter the available token options correctly, so I can quickly find the asset I intend to use.
4. As a widget user, I want yield searching, ranking, grouping, and category filtering to remain correct, so I can find an appropriate yield.
5. As a widget user, I want validator search requests to wait for the established debounce interval, so typing does not issue a request for every keystroke.
6. As a widget user, I want the UI to show that validator search is still debouncing, so loading feedback remains accurate.
7. As a widget user, I want obsolete validator-search results ignored after I change the query, so stale results cannot replace the active search.
8. As a widget user, I want loading more tokens to continue from the active token resource, so pagination remains coherent after selection or wallet changes.
9. As a widget user, I want loading more validators to target the active yield and normalized search, so pages cannot be appended to the wrong list.
10. As a widget user, I want accumulated pagination results preserved during later-page loading and retry, so lists do not disappear unnecessarily.
11. As a widget user, I want resource failures represented consistently, so I can distinguish loading, ready, empty, and recoverable failure states.
12. As a widget user, I want Retry to refresh the resource responsible for the current failure, so recovery does not reset unrelated state.
13. As a widget user, I want later refresh failures to retain usable prior data, so an auxiliary failure does not replace a coherent page with a blocking error.
14. As a widget user, I want my available amount, minimum, maximum, and force-max behavior to remain unchanged, so amount entry remains trustworthy.
15. As a widget user, I want amount validation to use one definition across Earn and position details, so the same Yield Entry is never accepted in one place and rejected in another.
16. As a widget user, I want provider selection and provider details to remain accurate, so the prepared Action Command uses the provider I selected.
17. As a widget user, I want reward estimates and reward-token details to remain accurate across Earn, position details, and review, so I can understand the expected result.
18. As a widget user, I want validator selection requirements to remain accurate, so a Yield Entry cannot proceed with missing or invalid validators.
19. As a widget user, I want KYC status and refresh behavior to remain consistent across Earn and position details, so eligibility is checked in the same way.
20. As a widget user, I want a blocked KYC gate to prevent submission without losing my form state, so I can resume after verification.
21. As a widget user, I want the generated Enter Action Command to retain address, token, validator, provider, subnet, Tron resource, Ledger, and max-amount arguments, so execution remains correct.
22. As a disconnected widget user, I want the Earn CTA to open the wallet connection modal, so I can connect and continue.
23. As a Ledger Live user, I want the add-account CTA to request and switch the account and close the chain modal, so Ledger account setup continues to work.
24. As a connected widget user, I want submitting a valid Yield Entry to start one fresh Classic Transaction Flow and navigate to Review, so the journey begins exactly once.
25. As a widget user, I want invalid submission to mark validation state without starting a transaction or navigating, so errors are visible and safe.
26. As a widget user, I want deep-link initialization to preserve its current readiness and selection behavior, so external links still land on the intended journey.
27. As a widget user, I want pending-action deep links to navigate only after their existing readiness conditions settle, so routes do not advance prematurely.
28. As a widget user, I want Classic Transaction Flow Continue, Back, and completion navigation to retain their existing history behavior, so Review, Steps, and Complete remain coherent.
29. As a widget user, I want Borrow Transaction Flow navigation to retain its existing session and completion behavior, so browser history cannot revive a disposed execution.
30. As a widget user, I want declarative route guards to keep redirecting invalid URLs safely, so missing or stale sessions do not render protected pages.
31. As a widget user, I want view-local tabs and back controls to behave as before, so ordinary interface navigation is not changed by workflow refactoring.
32. As a widget user, I want configured scroll-to-top behavior preserved on navigation that currently requests it, so page transitions retain their established presentation.
33. As a widget user, I want browser Back and replacement navigation to preserve their current semantics, so the history stack remains predictable.
34. As a widget user, I want stale Flow Sessions or Execution Attempts unable to navigate after replacement, so an obsolete workflow cannot take over the current screen.
35. As a widget user, I want analytics events for Max, Connect, Ledger account setup, submission, and workflow transitions to remain accurate, so product telemetry is not lost.
36. As a widget host, I want the React component export to remain compatible, so adopting this internal refactor requires no host changes.
37. As a widget host, I want the bundled renderer and its unmount/remount behavior to remain compatible, so imperative and CDN integrations continue working.
38. As a widget host, I want one memory router scoped to each Application Runtime Generation, so state from a prior API identity or sequential mount cannot leak into a later generation.
39. As a feature developer, I want stable capability view Atoms, so components subscribe only to the state they actually render.
40. As a feature developer, I want separate typed command Atoms, so UI events dispatch intent without carrying implementation callbacks.
41. As a feature developer, I want dynamic resource identity hidden inside the facade, so React never has to read one Atom to discover another Atom.
42. As a feature developer, I want pagination and retry exposed as semantic commands, so callers do not know which resource Atom is active.
43. As a feature developer, I want deterministic calculations implemented as pure TypeScript, so they are reusable and testable without ceremonial Atom wrappers.
44. As a feature developer, I want translation performed from semantic data in React, so application-logic modules remain React-free.
45. As a feature developer, I want local focus, disclosure, hover, animation, and element-reference state to remain in React, so the facade does not absorb presentation-only concerns.
46. As a feature developer, I want one `YieldSummary` interface for provider and reward projections, so activity, portfolio, review, completion, Earn, and position details stop importing Earn hooks.
47. As a feature developer, I want one `YieldEntry` interface for entry preparation and submission, so Earn and position details share the same behavior without depending on one another.
48. As a feature developer, I want each feature to supply its own input Atom to shared modules, so route, item, and Flow Session lifetimes remain owned by the caller.
49. As a feature developer, I want shared modules to consume Authoritative Resources rather than hook-owned fetches, so canonical remote read ownership remains intact.
50. As a feature developer, I want explicit normalized loading and failure states instead of nullable hook results, so callers do not infer why data is absent.
51. As a feature developer, I want application-owned navigation available as an Effect-backed runtime command, so workflow code does not publish outcomes for React to apply.
52. As a feature developer, I want navigation commands to accept canonical absolute destinations, so behavior is independent of React route context.
53. As a feature developer, I want router promises and failures owned by the runtime module, so event handlers never discard asynchronous navigation work.
54. As a feature developer, I want RainbowKit modal callbacks isolated in one named provider adapter, so third-party React constraints do not spread into feature state.
55. As a feature developer, I want command-related tracking performed with the command, so analytics follows the same ownership and stale-result checks as the behavior it records.
56. As a maintainer, I want the Earn machine to remain the sole source of Earn Selection and readiness, so a second writable page model cannot diverge from it.
57. As a maintainer, I want the aggregate Earn binding, aggregate page-model Atom, aggregate model type, and model hook removed, so the old architecture cannot remain as a compatibility layer.
58. As a maintainer, I want every consumer of the migrated shared hooks moved to feature or shared-module Atoms, so two architectures do not persist indefinitely.
59. As a maintainer, I want legacy calculation hooks deleted after migration, so ownership can be found from the module graph.
60. As a maintainer, I want unrelated surrounding feature logic left alone unless it blocks a headless dependency chain, so the migration remains bounded.
61. As a maintainer, I want dependency migration to stop at stable Atoms, Authoritative Resources, or immutable route/session input, so React values are not republished merely to satisfy a new facade.
62. As a maintainer, I want Classic and Borrow Flow scopes to retain their established ownership, so shared projections do not become application-global state.
63. As a maintainer, I want application navigation executed only from explicit commands or transition events, so reading a derived Atom never causes a side effect.
64. As a maintainer, I want route guards distinguished from workflow navigation commands, so authorization and route validity remain declarative.
65. As a maintainer, I want the module-global chain-modal callback holder removed, so sequential mounts and provider lifetimes do not depend on ambient mutable state.
66. As a maintainer, I want the final architecture to conform to the accepted facade and navigation ADRs, so code and documentation tell the same story.
67. As a test author, I want public facade and deep-module interfaces to be the primary seams, so tests survive internal file and helper refactors.
68. As a test author, I want to inject deterministic resource results, clocks, `WidgetNavigation` services, and WalletModal adapters, so asynchronous and external behavior can be tested without React orchestration.
69. As a test author, I want command branch tables for disconnected, connected, invalid, KYC-blocked, Ledger-placeholder, and valid Yield Entry states, so every submission decision is explicit.
70. As a test author, I want navigation integration tests to inspect the runtime-owned memory router, so Classic, Borrow, deep-link, and Yield Entry navigation can be verified without mounting React adapters.
71. As a test author, I want debounce tests to use deterministic time, so validator-search behavior is fast and reliable.
72. As a test author, I want existing browser journeys retained as end-to-end evidence, so internal refactoring cannot silently change user-visible behavior.
73. As a reviewer, I want deletion of old hooks, aggregate bindings, nested Atom view fields, and the router adapter bridge demonstrated in the final diff, so the migration proves replacement rather than layering.
74. As an AI coding agent, I want narrow named modules and stable public entries, so ownership and safe change surfaces are discoverable without tracing a monolithic React model.
75. As a widget host, I want ordinary live settings changes to preserve the current in-memory route, so configuration callbacks and presentation updates do not restart my journey.
76. As a widget host, I want an API-identity change to reset in-memory history with the rest of application state, so a fresh generation cannot open on a stale Review, Steps, or Details route.
77. As a feature developer, I want router construction and disposal owned by one scoped Layer, so React does not act as a dependency-injection bridge.
78. As a feature developer, I want React to obtain the runtime-owned router synchronously through an internal Atom, so `RouterProvider` needs no loading state, fallback router, or synchronization effect.
79. As a maintainer, I want `ApplicationRouter` to be the only service in the base runtime, so runtime composition stays explicit and minimal.
80. As a maintainer, I want `WidgetNavigation` constructed directly from `ApplicationRouter`, so a forwarding adapter does not duplicate the service boundary.
81. As a maintainer, I want the complete React Router instance restricted to top-level composition, so feature modules cannot bypass canonical navigation commands.
82. As a maintainer, I want the router explicitly disposed when its Application Runtime Generation closes, so pending navigation, loaders, blockers, and subscriptions cannot outlive their owner.

## Implementation Decisions

- ADR-0004 remains the base application-logic rule: Effect and Effect Atom own business state, asynchronous work, failure normalization, retries, concurrency, resource lifetimes, and command effects; React is a synchronous view adapter.
- ADR-0008 remains authoritative for canonical remote reads. Shared modules and feature facades derive from Authoritative Resources and do not create feature-owned remote caches or alternate retry and pagination policy.
- ADR-0009 remains authoritative for Earn Selection, Earn Readiness, failure precedence, initialization, and machine reconciliation. The new facade changes how that state is projected and consumed, not the machine's domain authority.
- ADR-0011 governs facade interfaces. Public view values contain no nested Atoms, Atom factories, or retry, refresh, pagination, or command callbacks.
- ADR-0012 governs application-owned navigation. An Application Runtime Generation owns the memory router and workflow decisions use the application-runtime navigation interface; React remains responsible for route guards and view-local navigation.
- The Earn machine remains the sole writable source of Earn Selection and entry-form intent. The facade derives capability views and forwards typed commands to the machine and active resources.
- Earn facade capabilities are organized by stable behavior rather than React component names. They cover token options, yield options, validators, amount and quote, yield summary, Yield Entry, submission and CTA, and page-level failure.
- The final Earn interface does not expose one aggregate page model. Consumers subscribe to the capability they render.
- Dynamic Authoritative Resource selection occurs inside derived or command Atoms. Token and validator Pull, loaded-validator memory, retry targets, and resource-family selection do not cross the facade.
- Token and yield search state is Atom-owned. Their filters are direct derived projections; React deferred values are removed unless later profiling establishes a separate presentation need.
- Validator search normalization and the established debounce interval are Atom-owned using Effect time. The active view exposes whether it is debouncing.
- Search, selection, pagination, loading, empty, and failure projections are deterministic and testable without React.
- Deterministic filtering, grouping, sorting, formatting, amount calculations, validation, reward calculations, provider projection, reward-token projection, yield-type projection, and Action Command construction remain pure TypeScript functions composed by Atoms.
- View Atoms expose semantic categories or translation keys rather than invoking React i18n. React performs translation and renders JSX without domain branching.
- Locale-independent deterministic formatting may occur in pure projections. Locale and translation-dependent presentation remains at the view seam.
- Synchronous local presentation state with no workflow meaning, persistence, asynchronous behavior, route lifetime, or cross-view coordination remains in React.
- `YieldSummary` is a top-level feature module with a narrow public entry. It accepts feature-owned input through an Atom and exposes a stable read-only view Atom.
- `YieldSummary` owns provider-yield lookup composition, provider details, reward-token details, semantic yield type, and normalized loading, ready, and failed states.
- `YieldSummary` does not own translation, route state, selection intent, transaction preparation, or feature-specific layout.
- `YieldEntry` is a top-level feature module with a narrow public entry. It accepts a feature-owned input Atom and exposes stable view and command Atoms.
- `YieldEntry` owns entry amount constraints, force-max projection, amount validation, KYC projection and refresh, estimated rewards, Enter Action Command construction, submission eligibility, CTA decisions, command-related analytics, transaction-session start, and application navigation.
- `YieldEntry` composes `YieldSummary` rather than duplicating its provider and reward projections.
- A feature input supplies selected yield, selected token, selected validators, selected provider, amount intent, relevant positions and balances, Wallet Scope facts, required configuration, and destination policy. Inputs express domain policy rather than caller names such as classic or dashboard.
- Earn and dashboard position-details entry compose `YieldEntry` with their own state and lifetime. The shared module does not import either caller.
- Classic position-details exit behavior may reuse extracted amount calculations without being forced into the entry module.
- Classic Transaction Flow review and completion compose `YieldSummary` inside their existing Session, Review, and Execution scopes.
- Activity and portfolio item projections use item-keyed feature Atoms and `YieldSummary`; they do not become global Earn state.
- When a required input is still React-hook-owned, its dependency chain is migrated only until it reaches a stable Atom, Authoritative Resource, or immutable route/session input. A React effect must not republish changing hook state into the new module.
- All current consumers of estimated rewards, amount limits, amount validation, provider details, reward-token details, yield KYC, yield type, stake-enter request construction, and pending-action deep-link adaptation are migrated.
- Legacy shared hooks are deleted when their final consumer moves. Thin wrappers are not retained in the finished change merely for compatibility.
- The aggregate Earn binding, aggregate page-model Atom, aggregate model type, and aggregate hook are deleted after classic and dashboard consumers migrate.
- The facade does not require a React provider or root binding. Derived capabilities live in the existing Widget Instance Atom registry, and consumers mount only what they read.
- Lifecycle Atoms are introduced only when an effectful resource genuinely follows route or view visibility. They do not assemble or publish aggregate view models.
- `WidgetNavigation` is a headless Effect module in the application runtime. Feature and workflow code depends on its narrow command interface, never on the React Router instance.
- A separate synchronous Atom runtime contains only `ApplicationRouter`. Its static scoped Layer creates the existing memory router and registers deterministic router disposal.
- The internal router Atom uses synchronous service projection. Router construction is treated as an invariant and does not add loading, retry, fallback-router, or recoverable failure UI.
- The React composition boundary reads the router Atom and passes the value to the DOM `RouterProvider`. React does not construct, retain, synchronize, or dispose the router.
- The complete router service remains internal to runtime composition. Feature modules receive `WidgetNavigation`, not the raw React Router instance.
- The Application Router runtime provides its Effect Context to the application runtime, following the existing application-runtime-to-wallet-runtime composition pattern.
- `WidgetNavigation` is constructed directly from `ApplicationRouter`. The production and test navigation adapter types, adapter Atom, registry-provider adapter input, and React forwarding object are removed.
- Tests of feature and workflow behavior provide `WidgetNavigation` directly. Focused integration tests use the real runtime-owned memory router.
- Application navigation commands use canonical absolute widget paths. Route helpers own destination construction.
- Navigation distinguishes push, replace, and back operations and carries a semantic scroll-reset or preserve policy. `WidgetNavigation` retains the existing widget configuration that can disable automatic scroll reset.
- The static root route configuration is assembled at the top-level React composition seam and supplied to the Application Router Layer. Application/service modules do not import React.
- The router remains a memory router. Browser and hash routers are not introduced.
- API-identity replacement closes the current Application Runtime Generation and creates fresh memory history. Live settings changes that retain the generation preserve the router.
- `RouterProvider` is imported from the documented DOM entrypoint. Router creation and route APIs continue to use the base React Router entrypoint.
- Workflow modules execute navigation only from explicit commands or transition events after checking current Flow Session, Execution Attempt, or intent ownership.
- Derived view Atoms never navigate when read, mounted, refreshed, or recomputed.
- Pending-action deep-link routing invokes `WidgetNavigation` directly once readiness and intent-claim rules pass; its React outcome bridge and delivery state are removed.
- Classic Transaction Flow forward, cancellation, and completion navigation invokes `WidgetNavigation` from its scoped commands or transition events. Existing stale-session suppression remains.
- Borrow Transaction Flow base, forward, and completion navigation invokes `WidgetNavigation` from its scoped commands or transition events. Existing epoch and execution checks remain.
- Declarative redirects that guard route validity remain React `<Navigate>` behavior.
- Tabs, breadcrumbs, view-local back controls, and external URL navigation remain outside `WidgetNavigation` unless separately redesigned.
- RainbowKit modal integration remains the one required React-only command seam for this effort.
- A named provider adapter installs connect- and chain-modal commands into a runtime-scoped `WalletModal` port and releases them on provider teardown.
- `WalletModal` callbacks are private adapter implementation. They do not appear in facade views, Yield Entry inputs, or command payloads.
- Ledger add-account behavior depends on `WalletModal` through the runtime and no longer accepts a close-modal callback as command data.
- The module-global latest-chain-modal callback holder is removed.
- Analytics caused by commands runs in the owning Atom/Effect command through the tracking runtime. Page-impression analytics may remain a route visibility adapter.
- The migration preserves public React and bundled-renderer interfaces.
- The migration preserves existing user-facing copy; no translation resource changes are required unless implementation reveals an accidental behavior dependency.
- The migration preserves single-Widget-Instance and sequential-remount constraints and introduces no machinery for concurrent Widget Instances.
- The final change contains one authority for each migrated behavior. Temporary compatibility used between local implementation stages is deleted before completion.
- Implementation proceeds in green stages: pure projections, shared resource selectors, runtime navigation and modal seams, shared modules, Earn facade and consumers, position details, transaction flows, activity and portfolio, legacy deletion, documentation alignment, and full verification.
- Existing unrelated React Query, direct `useNavigate`, and legacy hooks are not migrated unless they are in the required dependency chain or implement an Atom-generated navigation outcome covered by this spec.

## Testing Decisions

- Tests assert observable behavior through the highest stable interface: a feature facade, `YieldEntry`, `YieldSummary`, or `WidgetNavigation`. Tests do not inspect private mutable Atoms, private resource selection, helper call counts, React memoization, or file organization.
- Pure calculation tests cover filtering, grouping, sorting, amount limits, force-max behavior, validation, provider projection, reward projection, reward-token projection, semantic yield type, CTA projection, and Enter Action Command construction.
- `YieldSummary` interface tests use controllable Authoritative Resource results and assert normalized loading, ready, failed, refresh-with-value, provider, reward-token, and semantic type views.
- `YieldEntry` interface tests use controllable input Atoms and injected adapters. They assert amount constraints, KYC states and refresh, rewards, validation, CTA states, and command effects.
- Yield Entry command tests use a decision table covering disconnected, external-provider-hidden, connecting, invalid, submitted-invalid, missing request input, KYC-blocked, Ledger-placeholder, valid connected, and stale-owner cases.
- Yield Entry command tests assert transaction-session start, analytics, WalletModal commands, navigation commands, and non-occurrence of forbidden effects.
- Earn facade registry tests assert capability projections and commands without mounting React. Existing Earn machine registry tests remain the prior art for controlled machine, resource, and race behavior.
- Search tests use deterministic Effect time to assert normalization, the established validator debounce interval, the debouncing flag, query-key changes, and stale-result suppression.
- Pagination tests assert that stable load-more commands route to the active token or validator resource, ignore duplicate pulls while waiting, preserve accumulated values, and do not expose resource Atoms to callers.
- Retry tests assert that stable retry commands refresh the current responsible resource and do not retain a stale resource identity after selection or key changes.
- `WidgetNavigation` capability tests assert push, replace, back, absolute destinations, scroll policy, successful completion, and normalized failure without depending on React.
- Application Router integration tests assert that the first Atom read synchronously returns the memory router, real commands update its route state, one runtime generation preserves router identity, API-identity replacement creates fresh history, and registry disposal disposes the router exactly once.
- Pending-action deep-link registry tests assert readiness gating, intent claiming, Classic Flow start where required, and direct navigation without a mounted React adapter.
- Classic Flow facade tests assert Review-to-Steps, execution cancellation, completion, current-session checks, browser-history semantics, and suppression of stale navigation.
- Borrow Flow facade tests assert Base, Steps, Complete, session epoch checks, execution lifetime, and suppression of stale navigation.
- Route-level DOM/browser tests continue asserting declarative invalid-session guards because those guards intentionally remain React-owned.
- WalletModal adapter tests assert provider acquisition, replacement, cleanup, and unavailability behavior. Feature tests inject a fake port rather than mounting RainbowKit.
- Ledger account tests assert that successful account switching closes the chain modal through the port and that missing or invalid Ledger connectors retain typed failure behavior.
- Consumer migration tests replace mocked aggregate page-model hooks with Atom registry inputs or public module fakes.
- Existing provider-selection, validator-selection, Earn workflow, position-details, Classic Flow, Borrow Flow, deep-link, and staking browser tests are retained as behavior-level prior art.
- Browser tests cover at least one classic Earn journey and one dashboard/position-details Yield Entry journey through Review, proving that the shared module and runtime navigation integrate with real UI adapters.
- Regression tests assert that mounting and unmounting a Widget Instance releases modal adapters, router/runtime work, and scoped flow modules before sequential remount.
- Static verification rejects React-owned data-router construction, the removed navigation-adapter bridge, and raw router imports from feature modules.
- Static verification asserts no remaining imports of deleted shared hooks, aggregate Earn model interfaces, nested operational Atom fields in public view types, or React adapters for Atom-generated navigation outcomes.
- Lint and type checking are required after every materially complete stage. Focused unit and DOM tests run during slices; changed browser tests run for affected slices; full package verification runs before completion.
- Tests added for the new deep modules replace tests that only exercised deleted shallow hooks. Existing machine, schema, Authoritative Resource, and workflow tests remain when they still describe public behavior.
- A good test should survive moving helpers, splitting files, or changing private Atom composition. If a test changes solely because implementation internals move while interface behavior is unchanged, it is testing below the intended seam.

## Out of Scope

- Changing visible Earn, position-details, activity, portfolio, review, completion, KYC, or transaction-flow product behavior.
- Redesigning the UI, adding new controls, changing copy, or changing translations.
- Changing backend API contracts, generated schemas, Action Command semantics, wallet protocols, or transaction execution mechanics.
- Replacing or redesigning the existing Earn machine's selection, readiness, initialization, reconciliation, and failure precedence.
- Rewriting every surrounding activity, portfolio, position-details, or transaction-flow model. Only migrated capabilities and dependencies required to make them headless are included.
- Migrating every direct React Router `useNavigate` call. Declarative guards and view-local navigation remain React-owned.
- Converting Classic or Dashboard declarative routes into data-router route objects.
- Replacing the memory router with a browser, hash, or host-URL router.
- Mirroring route state into Atom before application logic has a concrete route-read requirement.
- Moving external URL navigation into the widget navigation module.
- Replacing RainbowKit or modifying its package interface.
- Migrating unrelated React Query resources or hook-owned logic outside the required dependency chains.
- Adding concurrency support for more than one mounted Widget Instance per browser document.
- Adding a second Atom registry, ad hoc Effect runtime, global router singleton, global navigation queue, or global normalized feature-state cache.
- Retaining a permanent compatibility aggregate page-model hook, callback-rich facade, or dual shared-hook implementation.
- Creating new module-specific architecture documents or storing the temporary implementation checklist in permanent architecture documentation.
- Prototyping alternative UI or state behavior; the design questions were resolved in conversation and ADRs.

## Further Notes

- The canonical term **Yield Entry** is defined in the project glossary. Avoid “Enter Action” for the pre-execution attempt because **Yield Action** refers to the created action and **Action Command** refers to its prepared instruction.
- `YieldSummary`, `WidgetNavigation`, facade, and port are implementation vocabulary and do not belong in the domain glossary.
- **Application Runtime Generation** is the canonical lifecycle term for application state under one stable API identity. Avoid the ambiguous term “Widget Runtime.”
- The accepted facade ADR supersedes only the part of the Earn-state ADR that allowed operational pagination and retry-target Atoms to cross the published view. The rest of the Earn-state decision remains authoritative.
- The accepted navigation ADR replaces the earlier living-architecture rule that React route adapters apply Atom navigation outcomes.
- Existing Classic and Borrow architecture documents and the widget-wide architecture document have already been aligned with the accepted target.
- The migration is complete across all eight tracer-bullet issues, including
  Application Runtime Generation ownership of the memory router.
- No runnable prototype is required before ticketing. The principal risks are migration breadth, lifecycle preservation, and behavioral regression, all of which have established registry and browser test seams.
