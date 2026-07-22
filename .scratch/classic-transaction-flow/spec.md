# Scope Classic Transaction Flow by Flow Session

Status: implemented

## Problem Statement

The recent Classic Transaction Flow refactor established one deep module and removed the previous Enter, Exit, Manage, and Activity Resume request authorities. It also introduced a global `keepAlive` facade whose active flow, preparation state, navigation outcome, lifecycle cleanup, and Transaction Workflow handoff are coordinated through a branded Classic Transaction Flow Identity.

That identity now does too many jobs. It names the journey, separates Action-preview resources and execution machines, targets commands and cleanup, suppresses stale asynchronous completions, and validates navigation. The model also stores `Reviewing | Executable` even though the router already owns Review, Steps, and Complete and action presence already determines whether execution is available. Back must replace an otherwise unchanged flow solely to invalidate its action and resource generation.

The four intake variants remain meaningful because they capture different required facts and action sources. The over-modeling is in their shared lifecycle, not in the tagged intake itself.

The widget needs a smaller authority shaped around the actual React and Atom lifetime: a runtime-level intake handoff enters one Flow Session tree, the tree owns its Atoms and resources, and leaving the complete journey disposes them. Equal user attempts are separated by a private runtime-local session epoch. That epoch exists only for React remounting, guarded external cleanup, and stale shared-router suppression; it is not a domain identity threaded through state and commands.

The accepted contract of at most one concurrently mounted Widget Instance per browser document remains unchanged. Concurrency and stale-work protection required inside that Widget Instance also remain required.

## Solution

Keep a small Widget application-runtime intake store containing the current immutable Flow Session entry. Every explicit Start captures the tagged intake, advances a monotonic runtime-local epoch, and creates a fresh `{ epoch, intake }` entry, even when its intake is structurally equal to a previous attempt. The epoch is used only by the session root's hidden compare-and-clear finalizer and the React session boundary key so an exiting tree cannot clear or retain a replacement.

Use the route's keyed `ScopedAtom` provider to create one session root Atom for the mounted Flow Session entry. Its Atoms use the existing application Atom registry, are not `keepAlive`, and are disposed with their mounted tree. A stable Flow Session route spans Review, Steps, and Complete. Session, Review, and Execution each expose one narrow scoped capability instead of one combined nullable context. Descendants dispatch keyless commands against the capability available in their subtree. The root Atom contains the only feature finalizer: epoch-guarded cleanup of the external intake slot. There is no public lifecycle Atom or identity family.

The intake variants remain `Enter | Exit | Manage | ActivityResume`, but there is no Classic Flow phase state. Review and Execution are fresh subtree modules created with `ScopedAtom` inside the existing application Atom registry. Enter, Exit, and Manage load a fresh Action Preview inside each Review scope. Activity Resume never recycles its selected action into Execution: Enter and Exit history reconstruct fresh preview requests, while Manage history without server passthrough is non-executable. Continue places the reviewed candidate into a private action handoff and publishes a Steps navigation outcome owned by that Review scope.

The Execution scope reads that action, spans Steps and Complete, and owns its Yield Action and Transaction Workflow. Returning to Review creates a new Review scope, clears the handoff, and permanently discards the previous action and machine. Atom unsubscription interrupts and releases the workflow; no execution key or cleanup Atom is involved. Execution cancellation navigation is owned by the Execution scope, so it cannot replay after unmount. Transaction signing, submission, confirmation, failure, retry, and completion remain Transaction Workflow state. Steps-to-Complete navigation remains a workflow outcome.

Atom resource interruption, refresh generations, and disposal suppress stale asynchronous publication. The captured Flow Session epoch is compared only when an exiting root clears the runtime intake store or a scoped router output verifies current ownership. Real API, invalid-action, unsupported activity recreation, wallet, and workflow failures remain typed and visible.

## User Stories

1. As a widget user, I want Review, Steps, and Complete to belong to one Flow Session so page remounts and animations do not reset my journey.
2. As a widget user, I want every explicit Start to create a fresh session snapshot even when the new intake equals the previous intake.
3. As a widget user, I want my Action Command, selected yield, tokens, validators, and Wallet Scope captured together so later source-page changes cannot alter what I review or execute.
4. As a widget user, I want Review to show action-derived gas and warning information before I Continue.
5. As a widget user, I want Continue to promote only the fresh Action Preview I reviewed into Execution.
6. As a widget user, I want a failed Action Preview to remain retryable without introducing a partially executable flow state.
7. As a widget user, I want returning from Steps to Review to permanently discard the execution action and workflow and require a fresh Action Preview.
8. As a widget user, I want browser Back and host-driven routing into Review to have the same semantics as the widget Back control.
9. As a widget user resuming activity, I want leaving execution to discard its workflow rather than restart or resurrect it through browser history.
10. As a widget user, I want repeated Continue, Back, or Retry input to be harmless rather than produce internal transition errors.
11. As a widget user, I want a late result or navigation from an exiting session unable to affect the current session.
12. As a connected-wallet user, I want disconnect or wallet-owner change to eject and dispose my Flow Session before execution can continue under another owner.
13. As an EVM wallet user, I want address casing differences treated as the same owner.
14. As a wallet user, I want additional-address-only changes to preserve the session and its captured execution inputs.
15. As a widget user, I want normal host-prop updates, live-configuration rerenders, and bundled `rerender` to preserve my Flow Session.
16. As a widget user, I want leaving the whole journey, replacing the application runtime, or unmounting the Widget to release session resources.
17. As a maintainer, I want one tagged immutable intake rather than four mutable request authorities.
18. As a maintainer, I want a scoped facade capability so React descendants cannot target or mutate another session.
19. As a maintainer, I want Action Preview state represented once by its Effect Atom `AsyncResult`, not duplicated by a preparation state machine.
20. As a maintainer, I want Transaction Workflow lifetime owned by a fresh Execution scope rather than session attached-action state or a global flow identity.
21. As a maintainer, I want Review resources and navigation owned by a fresh Review scope while one Execution scope owns Steps and Complete.
22. As a maintainer, I want stale-work protection provided by resource and session lifetimes, with the private session epoch localized to React remounting and shared external boundaries.
23. As a maintainer, I want classic and dashboard routes, deep links, KYC, warnings, tracking, completion behavior, and published copy preserved.
24. As a host developer, I want the existing one-Widget-Instance embedding, bundled unmount, and sequential-remount contracts preserved.

## Implementation Decisions

### Intake and Flow Session ownership

- The runtime intake store is the only state outside the Flow Session tree. Its private state contains the next monotonic epoch and the current immutable `{ epoch, intake }` entry or `null`.
- `start` is synchronous. It snapshots all intake facts, advances the epoch, and atomically replaces the current session. Equal intake still receives a distinct epoch.
- The epoch is local to one Widget application runtime. It uses no timestamp, randomness, object-reference lookup, branded domain key, or UUID.
- The store lives for the Widget application-runtime lifetime so it can bridge the source page and the destination route. The current session is cleared when its matching root exits; the whole store is disposed with runtime replacement or Widget unmount.
- Source UI may synchronously dispatch Start and navigate to its caller-owned Review route. Entry navigation has no asynchronous outcome and is not stored in the session.
- The Flow Session captures a full immutable Wallet Scope and copies mutable collections in the intake snapshot.

### Scoped facade and React boundary

- The Flow Session route's `ScopedAtom` creates the private session root Atom directly from the mounted entry. Its Provider is keyed by the entry epoch because Provider input is captured once. It does not use `Atom.family`, whose structural argument equality would conflate structurally equal starts.
- The route tree creates a fresh Review or Execution root Atom with `ScopedAtom.make`. Scoped atoms use the existing application Atom registry; do not create a nested `RegistryProvider` or a second registry.
- Session, Review, and Execution atoms are not `keepAlive` and use immediate idle disposal where necessary. The long-lived intake handoff does not make preview or workflow resources long-lived.
- One stable route boundary spans Review, Steps, and Complete. Navigation between those pages does not end the Flow Session.
- Session, Review, and Execution providers expose three separate narrow scoped capabilities. Do not add a combined context with nullable Review or Execution fields. Descendant hooks are zero-logic adapters, and commands take no session or route-entry key: `continue()`, `back()`, and `retry()`.
- The root finalizer clears the intake store only when the current entry still has its captured epoch. An exiting old root is an idempotent no-op after replacement.
- The facade derives `isCurrentSession` from the runtime intake store. Router outputs and any other shared-world boundary output are suppressed when that value is false, preventing an animated exiting tree from affecting the replacement session.
- Starting a new session or changing routes may temporarily overlap exiting React subtrees. Keyed Session boundaries, scoped child modules, guarded cleanup, and Atom disposal keep those trees isolated; only the newer Flow Session can publish shared navigation.

### Intake variants and state

- `Enter | Exit | Manage | ActivityResume` remain tags on the immutable intake because their required facts and action sources differ.
- The tags do not produce four mutable authorities, four lifecycle machines, or four sets of command atoms. Cross-cutting projections branch inside the facade; variant-specific review views remain narrowly typed.
- Remove `ClassicTransactionFlowIdentity`, `ClassicTransactionFlowPhase`, `Reviewing`, and `Executable` from the session model and facade contract.
- The only mutable Session state is the nullable execution-action handoff. Navigation, preview state, and workflow state belong to child scopes, not the Session.
- Execution availability is derived from the session's private action handoff. The router remains authoritative for whether the user is on Review, Steps, or Complete.
- Repeated or out-of-place valid UI intents are idempotent no-ops. Do not replace removed phase and identity variants with a new transition-result protocol.
- Deterministic input copying, projections, validation, and invariant checks remain plain TypeScript. Atom owns reactive state and commands; Effect owns typed asynchronous resources and workflow lifetime.

### Action Preview and Back

- Every Review subtree receives a fresh scoped facade. Enter, Exit, and Manage expose one Effect Atom Action Preview resource owned by that scope. The API continues to return the Yield Action candidate needed for gas estimation and warnings.
- Continue is available only after Action Preview success and while KYC permits it. Continue synchronously places that exact candidate into the action handoff and publishes `"Steps"` navigation owned by the Review scope.
- Action Preview loading and failure come directly from its `AsyncResult`. Retry refreshes that resource. There is no separate `Idle | Loading | Failure` preparation union.
- Ordinary preview failure does not place an action in the handoff. Invalid Exit preview content remains a typed, non-retryable failure at the existing validation seam.
- Entering Review from Steps by widget Back, browser history, or host routing creates a new Review scope. Review-scope initialization is the sole operation that synchronously clears the action handoff; the old Execution scope and machine disappear through Atom unsubscription and cannot affect a newer action.
- Back does not create a new Flow Session. The immutable intake snapshot remains unchanged.
- Activity Resume never seeds Execution from its historical action. Enter and Exit history build fresh preview requests. Manage history without the required passthrough is a typed, non-retryable preview failure.
- Review-pricing and gas-warning resources may retain reusable domain cache keys. Review-only subscriptions are released when Review unmounts.
- Execution actions and machines are never resurrected by browser Forward. A later Continue must use a new Action Preview; it does not restart a disposed machine.

### Navigation and Transaction Workflow

- Navigation is not session state. Each Review scope owns only `null | "Steps"`; each Execution scope owns only `null | "Review"`. Neither imports or commands React Router.
- Continue publishes Steps from the Review scope. Back publishes Review from the Execution scope. Unmounting the producing scope permanently removes its navigation outcome, so destination-entry consumption is unnecessary.
- The single route adapter renders navigation declaratively and only while the producing scope belongs to the current Flow Session. No session or route-entry identity is carried in the navigation outcome.
- Steps and Complete routes require an action handoff. Review routes are valid from immutable intake and acquire a new Review scope.
- Each Execution scope privately creates its Classic Transaction Workflow from its captured action and mounts the workflow module's dedicated root Atom. That root, rather than the `viewAtom` or a Steps page subscription, retains workflow state and completion subscriptions through both Steps and Complete. It does not pass a session identity through a global workflow-family handoff.
- Unmounting Execution disposes the corresponding machine. A later Continue uses a new previewed action and creates a new machine.
- Yield Action ID remains the workflow diagnostic, API, and history identity. Classic Flow introduces no additional numeric ownership key.
- Signing, submission, confirmation, retry, pending, failure, action-history invalidation, and completion stay inside Transaction Workflow. Steps-to-Complete navigation remains derived from workflow completion.

### Failure, interruption, and Wallet Scope

- Atom resource interruption, refresh generation, and node disposal prevent an old preview from publishing into a disposed or refreshed facade. The model does not return `StaleFlow`.
- An external API request may finish remotely after local interruption, but its result cannot attach an action, publish navigation, or mutate the current facade.
- Remove `NotReviewing`, `IdentityNotReplaced`, and other phase/identity coordination results. Preserve typed API, invalid-action, wallet, workflow, and genuine internal invariant failures.
- Wallet Scope owner validity remains network plus primary address, with case-insensitive EVM comparison. Additional-address-only changes neither invalidate the owner nor mutate the captured scope.
- Disconnect or Wallet Scope owner mismatch causes the route boundary to eject and dispose the session. It does not introduce an invalid-wallet facade state.

### Compatibility and delivery

- Preserve existing classic and dashboard routes, deep links, Review, Steps, Complete, tracking, KYC, warning behavior, translations, and published copy unless explicitly changed above.
- Preserve the public React and bundled entry APIs, the one-concurrent-Widget-Instance rule, bundled `rerender` and `unmount`, and sequential unmount/remount behavior.
- Perform the scoped-facade conversion atomically. Do not retain the current global facade, phase model, identity service, identity-keyed workflow wrappers, or compatibility mirrors alongside the new authority.
- Keep the Classic Transaction Flow architecture guidance aligned with the implementation: application logic remains React-free, view adapters remain synchronous, and no new React effects own session resources or transitions.

## Testing Decisions

- Intake-store tests prove monotonic runtime-local epochs, immutable snapshots, atomic replacement, guarded cleanup, and distinct sessions for structurally equal intake without clocks or randomness.
- Scope and boundary tests prove that equal-intake sessions have isolated session state, every Review and Execution provider gets a fresh scoped facade, and unmount disposes non-`keepAlive` atoms.
- Overlap tests mount an exiting old root and a current replacement together. Old cleanup cannot clear a new store entry, and scoped navigation cannot affect the shared router after its owner is stale.
- Action Preview tests cover eager Review loading, direct `AsyncResult` loading/failure, Retry, promotion of the reviewed candidate, invalid Exit preview, and fresh resources for later Review scopes.
- Back tests cover UI Back, browser history, and host-driven Review entry. Every path acquires a fresh Review scope, discards the execution action and machine, and requires a fresh Action Preview without replacing the intake snapshot.
- Activity Resume tests prove that the historical action is not recycled, reconstructable actions receive fresh previews, and returning to Review disposes the execution machine.
- Command tests prove that repeated Continue, Back, and Retry are idempotent and that facade commands require no key.
- Resource-lifetime tests prove that Review resources release outside Review while one Execution scope and Transaction Workflow remain alive through Steps and Complete.
- Workflow integration tests prove that different Execution scopes cannot share a machine, Activity Resume does not retain a disposed machine, and Yield Action ID remains the diagnostic and history identity.
- Route tests cover missing intake, missing action handoff on Steps, scoped navigation disposal, route-page remounts, animation overlap, and cleanup only after the owning subtree exits.
- Wallet tests cover disconnect, owner change, EVM address casing, additional-address-only changes, and immutable captured execution inputs.
- Runtime tests cover ordinary prop updates, live configuration changes, bundled `rerender`, application-runtime replacement, Widget unmount, and sequential remount.
- Focused behavior and lifecycle tests protect against reintroducing global `keepAlive` flow state, domain flow identity, stored phases, keyed descendant commands, or React-owned asynchronous orchestration.
- Focused DOM route tests cover the production Session, Review, and Execution boundaries, while focused Chromium tests cover real Transaction Workflow execution and interruption. The existing classic and dashboard regression suites continue to protect route, KYC, warning, tracking, completion, and copy behavior outside this lifetime seam.
- Focused unit and DOM suites, representative Chromium suites, widget lint/type checking, and relevant hygiene checks form the validation ladder.

## Out of Scope

- Supporting multiple concurrently mounted Widget Instances in one browser document.
- Replacing the existing application Atom registry with nested per-route registries.
- Changing Action-preview API contracts or removing action-derived gas and warning information from Review.
- Validating returned Yield Action address, yield ID, or action type against intake beyond existing focused validation.
- Modeling or compensating for irreversible wallet or submission side effects after Back.
- Moving signing, submission, confirmation, retry, pending, failure, or completion state into Flow Session.
- Redesigning classic or dashboard UI, routes, KYC, warnings, tracking, translations, or copy.
- Changing price or gas-warning domain cache behavior beyond lifecycle wiring.
- Breaking public package entrypoints or the accepted embedding contract.

## Further Notes

- This specification uses the repository's Classic Transaction Flow, Flow Session, Action Command, Action Preview, Yield Action, Activity Resume, Wallet Scope, Transaction Workflow, and Widget Instance vocabulary.
- Flow Session epoch is deliberately technical. Equivalent user attempts and overlapping React trees need distinct ownership, but the epoch is not exposed as domain identity or passed through descendant commands.
- The key architectural goal is lifetime alignment: the intake store bridges into the journey, the Flow Session boundary owns only coordination, a fresh Review scope owns review resources, and a fresh Execution scope owns its one-shot action and Transaction Workflow through Steps and Complete.
- Information hiding follows from that ownership. React receives one scoped facade capability and cannot address another session or mutate private storage.
- A synchronization mechanism remains justified when it protects real intra-instance concurrency. Removing Classic Transaction Flow Identity does not remove command serialization, scoped interruption, wallet synchronization, or the private epoch checks at shared external boundaries.
