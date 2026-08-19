# Classic Transaction Flow architecture

Classic Transaction Flow is the reference implementation of ADR-0017. Its
application logic has three explicit tiers:

- `model/` owns deterministic route, intake, ownership, copy, transition, and
  projection decisions. It has no Effect Atom dependency.
- `state/orchestration/` owns the private `ClassicTransactionFlowService` and
  its scoped Session, Review, and Execution implementation modules. They expose
  semantic operations and only production-consumed state, and have no Atom
  dependency.
- `state/atoms/` owns reactive composition and route-scope adaptation. It is
  split into top-level Flow, Session, Review, and Execution adapters, projects
  authoritative service state into view Atoms, and forwards one semantic
  operation per command Atom. A shared app-runtime lifecycle adapter performs
  scoped acquisition, keep-alive, optional state projection, and release.

React adapters live in `react/` and `ui/`. They render published Atom views,
normalize UI events, and synchronously dispatch Atom commands. They do not own
workflow advancement, retries, rollback, or cleanup.

## Lifetimes and ownership

`ClassicTransactionFlowService` is eagerly constructed once per Wallet Runtime,
remains alive independently of route mounts, and is the sole writer of the
active Classic Flow Session. Its layer resolves `WalletService`,
`WidgetNavigation`, `YieldOperations`, `TrackingService`, and
`TransactionWorkflowService` once. Runtime operations close over those adapters
and do not use local `Effect.provideService` calls.
Private Session, Review, and Execution factory effects yield their own static
service dependencies while that layer is constructed; invoking the resulting
factories later passes only dynamic ownership and route-scope inputs.

Every accepted Start captures an immutable intake snapshot, assigns a fresh
monotonic local epoch, reserves the Session before navigation, and rolls back
only that same reservation if navigation fails. The service reads
`WalletService` directly and invalidates the active Session when its Wallet
Scope Owner becomes ineligible. Its `currentSession` Stream is the only
observable top-level state; epochs, queues, flags, and lifecycle events remain
private. Every explicit Start creates a fresh Session even for equal intake.
Start returns the captured Session, and later operations receive that Session so
a stale route or click cannot affect a replacement.

A route-tree Session module is acquired for the active snapshot. The Atom bridge
can observe only its immutable intake and call `acquireReview(eligibilityStream)`
or `acquireExecution()`. Current-ownership checks, epoch comparison, clearing,
execution reservation, rollback, and navigation handoff are private. Releasing
the Session clears only its captured Session; a stale scope cannot clear or
navigate a replacement. The service's current Session is the sole Wallet Scope
eligibility authority, while React route guards check only route and intake
variant compatibility.

Every Review route mount acquires a fresh Review module. Its interface is exactly
the Action Preview state Stream and `confirm()`. KYC and Activity expiry remain
reactive Atom-owned observations supplied as one normalized, read-only
eligibility Stream; eligibility is consumed privately and is not republished as
Review state. Review autonomously starts Preview when eligibility unblocks.
`confirm()` ensures or retries Preview according to existing policy, promotes
the action, revalidates the latest eligibility immediately before reservation,
records tracking, and navigates with rollback. Atom and UI callers do not
sequence those steps. Cacheable prices, balances, gas checks, and KYC resources
remain Authoritative Resources.

Session owns one private atomic `promoteToExecution(action)` capability. It
validates current ownership, rejects duplicate reservation, reserves the action,
navigates to Steps, and rolls back only the same reservation on navigation
failure or interruption. The reservation is private state, not an observable
Session Stream.

`acquireExecution()` returns Acquired with a fresh Execution handle, Rejected No
Reservation, or Rejected Stale. Expected acquisition ineligibility stays in the
success channel; operational construction failure uses the Effect error channel.
Every acquired Execution scope captures the reserved action and owns one
Transaction Workflow handle for the whole Steps-and-Complete route lifetime.
Its interface exposes the Transaction Workflow state Stream, an operation
accepting the existing `TransactionWorkflowCommand`, Back, and Finish. These
operations return Accepted or Rejected Stale, with navigation failures in the
error channel. Completion observation and navigation retry are automatic;
both Completed workflows and Disabled fixed batches with no remaining
transactions navigate to Complete. Navigation carries the terminal transaction
URL summary, while Activity completion presentation remains a safe nullable Atom
projection of the terminal Transaction Workflow state. Navigation retries every
100 milliseconds until success or scope interruption.

Complete presentation derives its journey meaning from the Flow Session's
captured intake and mount. It does not inspect Position Details or other
originating Feature routes to rediscover whether the Session represents Exit,
Manage, Enter, or Activity Resume.

Classic transaction confirmation treats `NOT_FOUND` as an intermediate status:
the status endpoint can report it before the submitted transaction becomes
visible. Like other non-terminal statuses, it remains eligible for the Classic
polling policy of 75 attempts spaced four seconds apart. `FAILED` and `BLOCKED`
are terminal failures; `CONFIRMED` and `SKIPPED` are terminal successes.
Session replacement, wallet invalidation, promotion, workflow dispatch, and
UI-owned navigation share the service ownership serializer, so UI outputs are
suppressed after ownership becomes stale. Transaction Workflow operations
independently publish semantic invalidation for authoritative Activity and
balance resources.

Classic exposes no orchestration event Streams. The unused Transaction Workflow
event Stream and Atom projection are also removed; tests assert authoritative
state and operation effects. A neutral scoped-serialization helper under
`src/shared/effect` captures its owner Scope, forks each serialized operation
into that Scope, and propagates caller interruption to the forked operation
without exposing those lifetime mechanics to Flow policy.

## Published interface

The root `index.ts` publishes the existing narrow Atom facade: Start,
active-path observation, Dashboard Activity Resume capability, and zero-logic
hooks. The Effect service is published separately through `runtime.ts` for the
Wallet Runtime and its deep-link coordinator; Session values, epochs,
destinations, lifecycle handles, and implementation state remain private.
Dependency-cruiser enforces those entry audiences.

Command Atoms read or normalize a reactive snapshot and delegate to exactly one
semantic service or scoped-handle operation. Scoped acquisition is explicit,
normally as an `AsyncResult`; adapters do not fabricate initial Review or
Transaction Workflow state or maintain writable mirrors. React uses the existing
loading or skeleton presentation until authoritative state arrives. Registry
reads and lifecycle machinery are confined to the shared app-runtime adapter;
feature authors and callers do not manually list `context.mount(...)` graphs.

The module does not introduce a Classic Flow domain identity, a separate phase
state machine, a generic Transaction Flow engine, or an identity-keyed
Transaction Workflow handoff. Review promotion reserves the action in the
Session; entering a later Review scope clears that handoff, so widget Back,
browser Back, and host routing share the same behavior. Borrow remains a
separate journey-specific service and is the next vertical migration slice;
only neutral lifecycle infrastructure is shared now.

The dead action-history revision Atom and its increment/reset plumbing are
removed. The `TransactionWorkflowEnded` resource projection invalidates the
authoritative Activity resource through `ActivityInvalidationKey` after the
Execution Attempt is left.

The document-claim callback-ref bridge in
`app/embedding/widget-instance-react-boundary.tsx` remains the only reviewed
external React boundary for this effort.
