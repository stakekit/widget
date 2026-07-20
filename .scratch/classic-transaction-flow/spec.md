# Scope Classic Transaction Flow by Flow Session

Status: ready-for-agent

## Problem Statement

The recent Classic Transaction Flow refactor established one deep module and removed the previous Enter, Exit, Manage, and Activity Resume request authorities. It also introduced a global `keepAlive` facade whose active flow, preparation state, navigation outcome, lifecycle cleanup, and Transaction Workflow handoff are coordinated through a branded Classic Transaction Flow Identity.

That identity now does too many jobs. It names the journey, separates Action-preview resources and execution machines, targets commands and cleanup, suppresses stale asynchronous completions, and validates navigation. The model also stores `Reviewing | Executable` even though the router already owns Review, Steps, and Complete and action presence already determines whether execution is available. Back must replace an otherwise unchanged flow solely to invalidate its action and resource generation.

The four intake variants remain meaningful because they capture different required facts and action sources. The over-modeling is in their shared lifecycle, not in the tagged intake itself.

The widget needs a smaller authority shaped around the actual React and Atom lifetime: a runtime-level intake handoff enters one Flow Session tree, the tree owns its facade atoms and resources, and leaving the complete journey disposes them. A fresh technical session generation is still required to separate equal user attempts and protect shared external boundaries, but it must not become a domain identity threaded through every state and command.

The accepted contract of at most one concurrently mounted Widget Instance per browser document remains unchanged. Concurrency and stale-work protection required inside that Widget Instance also remain required.

## Solution

Keep a small Widget application-runtime intake store containing a monotonically increasing generation and the current immutable Flow Session snapshot. Every explicit Start captures the tagged intake and creates a fresh `{ key, intake }`, even when its intake is structurally equal to a previous attempt. The key is an opaque runtime-local generation, not a wall-clock timestamp or domain identity.

Use `Atom.family` to create one facade object for each Flow Session. Its atoms use the existing application Atom registry, are not `keepAlive`, and are disposed with their mounted tree. A stable Flow Session boundary spans Review, Steps, and Complete, provides the selected facade through React context, and owns matching cleanup. Descendants dispatch keyless commands against that capability rather than passing an identity.

The intake variants remain `Enter | Exit | Manage | ActivityResume`, but there is no Classic Flow phase state. Enter, Exit, and Manage load a fresh Action Preview while Review is mounted. Continue attaches the successfully loaded candidate and publishes Steps navigation. Returning to Review detaches the action, disposes its Transaction Workflow, and invalidates the preview so a later Continue uses a freshly prepared Yield Action. Activity Resume begins with its existing action attached and retains it when moving between Review and Steps.

The facade privately owns the Transaction Workflow while an action is attached. Transaction signing, submission, confirmation, failure, retry, and completion remain Transaction Workflow state. Steps-to-Complete navigation remains a workflow outcome.

Atom resource interruption, refresh generations, and disposal suppress stale asynchronous publication. The Flow Session key is compared only where an exiting tree can affect shared state: clearing the runtime intake store and publishing navigation to the shared router. Real API, invalid-action, wallet, and workflow failures remain typed and visible.

## User Stories

1. As a widget user, I want Review, Steps, and Complete to belong to one Flow Session so page remounts and animations do not reset my journey.
2. As a widget user, I want every explicit Start to create a fresh session even when the new intake equals the previous intake.
3. As a widget user, I want my Action Command, selected yield, tokens, validators, and Wallet Scope captured together so later source-page changes cannot alter what I review or execute.
4. As a widget user, I want Review to show action-derived gas and warning information before I Continue.
5. As a widget user, I want Continue to attach only the Action Preview I reviewed.
6. As a widget user, I want a failed Action Preview to remain retryable without introducing a partially executable flow state.
7. As a widget user, I want returning from Steps to Review in Enter, Exit, or Manage to discard the attached action and require a freshly prepared action.
8. As a widget user, I want browser Back and host-driven routing into Review to have the same semantics as the widget Back control.
9. As a widget user resuming activity, I want the selected existing Yield Action and its execution progress retained across Review and Steps.
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
20. As a maintainer, I want Transaction Workflow lifetime owned by the attached action rather than separated through a global flow identity.
21. As a maintainer, I want review-only resources released outside Review while execution progress survives Steps and Complete.
22. As a maintainer, I want stale-work protection provided by resource and session lifetimes, with session-key comparison localized to shared external boundaries.
23. As a maintainer, I want classic and dashboard routes, deep links, KYC, warnings, tracking, completion behavior, and published copy preserved.
24. As a host developer, I want the existing one-Widget-Instance embedding, bundled unmount, and sequential-remount contracts preserved.

## Implementation Decisions

### Intake and Flow Session ownership

- The runtime intake store is the only state outside the Flow Session tree. Its private state contains the next monotonic generation and the current immutable `{ key, intake }` or `null`.
- `start` is synchronous. It snapshots all intake facts, increments the generation, and atomically replaces the current session. Equal intake always receives a different key.
- The generation is local to the Widget application runtime. It does not use `Date.now`, randomness, object reference identity, or a branded domain UUID.
- The store lives for the Widget application-runtime lifetime so it can bridge the source page and the destination route. The current session is cleared when its matching boundary exits; the whole store is disposed with runtime replacement or Widget unmount.
- Source UI may synchronously dispatch Start and navigate to its caller-owned Review route. Entry navigation has no asynchronous outcome and is not stored in the session.
- The Flow Session captures a full immutable Wallet Scope and copies mutable collections in the intake snapshot.

### Scoped facade and React boundary

- `flowFacadeFamily(session)` returns the complete private facade for that session. The unique generation participates in family equality so structurally equal attempts cannot reuse facade state.
- Family atoms use the existing application Atom registry. Do not create a nested registry or React provider for a second registry.
- Session atoms are not `keepAlive` and use immediate idle disposal where necessary. The long-lived intake handoff does not make facade, preview, or workflow state long-lived.
- One stable route boundary spans Review, Steps, and Complete. Navigation between those pages does not end the Flow Session.
- The boundary provides the selected facade through React context. Descendant hooks are zero-logic adapters, and commands take no session key: `continue()`, `back()`, and `retry()`.
- The boundary finalizer clears the intake store only when the current store key still equals its captured key. An exiting old boundary is an idempotent no-op after replacement.
- The facade derives `isCurrentSession` from the runtime intake store. Router outputs and any other shared-world boundary output are suppressed when that value is false, preventing an animated exiting tree from affecting the replacement session.
- Starting a new session may temporarily overlap the exiting React tree of the previous session. The family members remain isolated; only the newer key is current.

### Intake variants and state

- `Enter | Exit | Manage | ActivityResume` remain tags on the immutable intake because their required facts and action sources differ.
- The tags do not produce four mutable authorities, four lifecycle machines, or four sets of command atoms. Cross-cutting projections branch inside the facade; variant-specific review views remain narrowly typed.
- Remove `ClassicTransactionFlowIdentity`, `ClassicTransactionFlowPhase`, `Reviewing`, and `Executable` from the session model and facade contract.
- Execution availability is derived from an attached Yield Action. The router remains authoritative for whether the user is on Review, Steps, or Complete.
- Repeated or out-of-place valid UI intents are idempotent no-ops. Do not replace removed phase and identity variants with a new transition-result protocol.
- Deterministic input copying, projections, validation, and invariant checks remain plain TypeScript. Atom owns reactive state and commands; Effect owns typed asynchronous resources and workflow lifetime.

### Action Preview and Back

- Enter, Exit, and Manage expose one Effect Atom Action Preview resource while Review is mounted. The API continues to return the Yield Action candidate needed for gas estimation and warnings.
- Continue is available only after Action Preview success and while KYC permits it. Continue synchronously attaches that exact candidate and publishes `"Steps"` navigation.
- Action Preview loading and failure come directly from its `AsyncResult`. Retry refreshes that resource. There is no separate `Idle | Loading | Failure` preparation union.
- Ordinary preview failure does not attach an action. Invalid Exit preview content remains a typed, non-retryable failure at the existing validation boundary.
- Entering Review from Steps by widget Back, browser history, or host routing applies Back semantics. For Enter, Exit, and Manage it detaches the Yield Action, releases the Transaction Workflow, invalidates any candidate, and requires a fresh preview.
- Back does not create a new Flow Session. The immutable intake and session generation remain unchanged.
- Activity Resume has no Action Preview resource. Its existing Yield Action is always the attached action and is retained across Review and Steps.
- Review-pricing and gas-warning resources may retain reusable domain cache keys. Review-only subscriptions are released when Review unmounts.
- The refactor does not inspect, block, compensate for, or model irreversible wallet or submission side effects that might have occurred before returning to Review.

### Navigation and Transaction Workflow

- The Flow Session facade owns only `null | "Steps" | "Review"` navigation intent. It does not import or command React Router.
- Continue publishes Steps after successful attachment. Back publishes Review. Destination route entry consumes the matching intent so browser history is not trapped by a persistent redirect.
- Navigation adapters render declaratively and only while `isCurrentSession` is true. No session identity is carried in the navigation outcome.
- Steps routes require an attached action. Review routes are valid from immutable intake and apply the agreed Back normalization on entry.
- Each facade privately creates and owns its Classic Transaction Workflow while an action is attached. It does not pass a session identity through a global workflow-family handoff.
- Enter, Exit, and Manage action removal disposes the corresponding machine. Their freshly previewed replacement action creates a fresh machine.
- Activity Resume action retention keeps the same machine mounted across Review and Steps within that Flow Session.
- Yield Action ID remains the workflow diagnostic, API, and history identity. Flow Session generation remains a local ownership key only.
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
- Update the Classic Transaction Flow architecture checks so touched application logic remains React-free, view adapters remain synchronous, and no new React effects own session resources or transitions.

## Testing Decisions

- Intake-store tests prove monotonic generation, immutable snapshots, atomic replacement, and distinct sessions for structurally equal intake without clocks or randomness.
- Family and boundary tests prove that equal-intake sessions have isolated facade state and that unmount disposes non-`keepAlive` atoms.
- Overlap tests mount an exiting old boundary and a current replacement together. Old cleanup cannot clear the new store entry, and old navigation cannot affect the shared router.
- Action Preview tests cover eager Review loading, direct `AsyncResult` loading/failure, Retry, attachment of the reviewed candidate, invalid Exit preview, and disposal or refresh of stale work.
- Back tests cover UI Back, browser history, and host-driven Review entry. Enter, Exit, and Manage detach the action, dispose the machine, and fetch a fresh preview without changing session generation.
- Activity Resume tests prove that Back retains its action and machine and never requests Action Preview.
- Command tests prove that repeated Continue, Back, and Retry are idempotent and that facade commands require no key.
- Resource-lifetime tests prove that review-only resources release outside Review while an attached Transaction Workflow remains alive through Steps and Complete.
- Workflow integration tests prove that different Flow Sessions cannot share a machine, Activity Resume preserves its machine within one session, and Yield Action ID remains the diagnostic and history identity.
- Route tests cover missing intake, missing action on Steps, destination-intent consumption, route-page remounts, animation overlap, and cleanup only after the whole journey exits.
- Wallet tests cover disconnect, owner change, EVM address casing, additional-address-only changes, and immutable captured execution inputs.
- Runtime tests cover ordinary prop updates, live configuration changes, bundled `rerender`, application-runtime replacement, Widget unmount, and sequential remount.
- Architecture tests reject reintroduction of global `keepAlive` flow state, domain flow identity, stored phases, keyed descendant commands, React-owned asynchronous orchestration, or unreviewed React lifecycle cleanup.
- Representative classic and dashboard browser tests retain Enter, Exit, Manage, and Activity Resume coverage through Review, Steps, Complete, deep links, KYC, warnings, tracking, and copy.
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
- Flow Session generation is deliberately technical. It exists because equivalent user attempts and overlapping React trees require distinct ownership, but it is not exposed as domain identity.
- The key architectural goal is lifetime alignment: the intake store bridges into the journey, the Flow Session boundary owns session state, Review owns review resources, and the attached action owns Transaction Workflow.
- Information hiding follows from that ownership. React receives one scoped facade capability and cannot address another session or mutate private storage.
- A synchronization mechanism remains justified when it protects real intra-instance concurrency. Removing Classic Transaction Flow Identity does not remove command serialization, resource generations, scoped interruption, wallet synchronization, or router-boundary ownership checks.
