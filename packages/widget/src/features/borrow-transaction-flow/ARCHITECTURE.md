# Borrow Transaction Flow architecture

Borrow Transaction Flow owns the routed Review, Steps, and Complete journey.
Every Start captures an immutable intake, Wallet Scope, and monotonic session
epoch. Its intake contains one prepared Action Command and an action-specific
review summary derived from the same private Borrow preparation facts. The flow
does not reconstruct or reinterpret risk, balances, or form input. Review owns
Borrow action creation from that command; entering execution creates a fresh
shared Transaction Workflow module for the created action.

Review exposes one deep Confirm operation. Confirm creates the Borrow Action
from the immutable Action Command, rejects terminal actions, reserves the valid
action for Execution, and navigates to Steps. If navigation fails or is
interrupted, Review rolls back only that reservation. Creation failure remains
observable on Review, and invoking Confirm again retries the complete operation;
Atom callers do not separately create, retry, reserve, or navigate.
Because Borrow has no autonomously loaded Review state, its Review handle does
not expose a state Stream. The Confirm command Atom's `AsyncResult` represents
waiting and operational failure without duplicating operation status as
authoritative feature state.

Confirm returns only Confirmed, Rejected Already Reserved, or Rejected Stale;
the created action never crosses the Review interface. Borrow API failure and
an immediately terminal created action fail with a typed Borrow Action Creation
error, while failure to enter Steps remains a typed navigation error.

All Borrow Flow ownership mutations and UI effects pass through one
service-level scoped serializer. Start, Review Confirm and Back, Execution
commands, Finish, action reservation, and navigation
therefore have one ordering authority. Every operation revalidates current
Flow Session ownership after acquiring the serializer, and closing the owning
scope interrupts queued and in-flight work. Atom concurrency settings remain
presentation behavior rather than a correctness dependency.

Borrow Transaction Flow publishes no form-reset outcome. Successful Transaction
Workflow construction publishes the owner-scoped `TransactionWorkflowStarted`
fact through the shared Widget Domain Events service. Feature-owned projections
consume Entry Intent from that fact without introducing an import from the flow
back into `features/borrow`. Leaving Review before workflow construction
preserves Borrow-owned Entry Intent.

Route-changing transitions keep navigation interruptible, including reservation
rollback when Confirm navigation fails or is interrupted. Widget Domain Event
publication is owned by Transaction Workflow construction and finalization, not
by Borrow navigation transitions.

Navigation executes inside the Effect-native module that owns the accepted
transition. Re-entering Review after execution clears the private action
handoff, so browser history cannot restart a disposed workflow. Only the current
session epoch may navigate; transaction-truth work remains owned by the scoped
Transaction Workflow.

The owning Borrow feature starts a session through a command Atom that re-reads
the current `Ready` preparation, captures the immutable intake, and tail-delegates
to Borrow Flow Start. React event handlers dispatch that command without
carrying a prebuilt review or choosing a destination.

The Borrow Flow Start interface accepts only that immutable intake. The service
derives the Review destination from the captured entry and performs the Push;
Borrow Entry and Market Position callers cannot supply a navigation command or
pair an entry with an inconsistent route.

Every accepted Start installs a fresh epoch and abandons any previous Borrow
Flow Session immediately. If navigation to the new Review fails or is
interrupted, rollback clears only the newly installed Session; it never
resurrects the replaced attempt.

Start re-reads current Widget configuration and Wallet state inside its
serialized service operation. Disabled Borrow and a non-owning Wallet Scope are
expected `RejectedDisabled` and `RejectedOwner` outcomes rather than operational
failures. Borrow Entry and Market Position remain responsible for resolving a
current `Ready` preparation before producing normalized intake; the flow does
not recreate their resource or form policy.

The wallet-scoped service observes Wallet state for the lifetime of the
runtime. If the current Wallet Scope stops owning the active immutable intake,
the service clears that Flow Session through the same serializer. It does not
navigate during Wallet invalidation; the route guard reacts to the empty
current-session Stream and redirects to the entry-appropriate base route.

Acquiring the current Flow Session returns a route-scoped Session handle.
Releasing that scope clears the Session only when its epoch is still current,
so ordinary route exit abandons the flow while an old route finalizer cannot
clear a replacement Start. Back and Finish do not coordinate a separate Clear
command, and React does not mount a cleanup Atom.

Route compatibility includes exact entry identity. A Market Position Session is
compatible only with the same URL `marketId`; when Session A is presented under
market B's Review, Steps, or Complete route, the guard Replace-navigates to
market B's base details route and releases Session A.

The Session handle exposes only immutable intake, `acquireReview`, and
`acquireExecution`. Acquiring Review clears any reserved action and creates a
fresh Review scope, ending a previous Execution Attempt reached through browser
history. Execution acquisition returns typed Acquired, Rejected No Reservation,
or Rejected Stale outcomes. Epoch checks, action reservation, cleanup, and
event publication remain private implementation.

Borrow follows Classic's Effect-native service, private Session, scoped Review
and Execution factories, lifecycle adapters, and serialized ownership model.
It reuses only already-neutral infrastructure during migration. Borrow-specific
action creation, destinations, and intake policy remain local; a
generic Transaction Flow factory is considered only after both completed
implementations demonstrate identical policy as well as mechanics.

Borrow Back deliberately differs from Classic execution behavior. Review Back
and Execution Back both Replace to the immutable entry's base route, ending the
Borrow Flow rather than returning from Steps to Review. A browser-history entry
that reaches Review still acquires a fresh Review scope and clears the previous
action reservation.

Execution Finish reads the authoritative Transaction Workflow state and is
accepted only when it is Completed and its Session and reserved action are
still current. Otherwise it returns Rejected Not Completed or Rejected Stale.
The Complete route guard remains presentation behavior and is not the
correctness condition for navigation or workflow finalization.

The scoped Execution module observes the first Completed Transaction Workflow
state and automatically replaces to the immutable entry's Complete route. It
preserves the existing completion-navigation policy during migration: retry
every 100 milliseconds until navigation succeeds or the Execution scope closes,
revalidating Session and reservation ownership on every attempt. This retry is
application policy rather than an Effect requirement; changing unbounded retry
or exposing navigation failure is a separate decision applied to both flows.

The Execution handle exposes only the Transaction Workflow state Stream,
`runWorkflow`, `back`, and `finish`. Workflow commands and Back return Accepted
or Rejected Stale; Finish may also return Rejected Not Completed. Automatic
completion navigation and the created action remain private. The Atom adapter
projects the Borrow execution view and publishes phase-local command Atoms, so
Review Back and Execution Back are not one phase-ambiguous command even though
their current destinations match.

The Borrow Flow's Atom adapters contain no direct registry access,
subscriptions, manual Atom finalizers, `context.mount`, or React `useAtomMount`.
The shared scoped Effect Atom adapters encapsulate handle acquisition, optional
state projection, keep-alive, and scope release; route code only reads the
scoped module. Borrow Entry and Market Position event projections remain
feature-owned production-observer lifecycles outside this vertical slice.

`BorrowTransactionFlowService` is constructed once by the Wallet Runtime's
scoped layer. Its constructor and private Session, Review, and Execution factory
initializers yield every static Effect dependency and close over the resolved
adapters. Runtime factory calls accept only dynamic Session, intake, reserved
action, route, and private parent-capability values. They neither receive
concrete service instances nor call local `Effect.provideService`; the
service is published through `runtime.ts`, whose audience is limited to the
application runtime for layer wiring.

Behavior tests cross the production `BorrowTransactionFlowService` interface
using its real layer and test adapters for external capabilities. A small Atom
adapter suite covers service lookup, reactive Session projection,
scope acquisition and release, and one-to-one operation forwarding; browser
tests retain rendered journey coverage. Registry-heavy store and facade tests
are deleted once equivalent behavior is covered, and private child factories do
not become parallel behavior-test surfaces.

Scoped Session and Execution acquisition are represented explicitly as
`AsyncResult`. Pending acquisition or a pending first authoritative Transaction
Workflow state renders loading; only resolved No Reservation or Stale outcomes
redirect. The Atom adapter does not call `initializeTransactionWorkflow` or
fabricate a temporary workflow state, and an acquired Execution state Stream
emits its complete authoritative initial state immediately.

Execution acquisition keeps semantic unavailability and operational failure
separate. Rejected No Reservation and Rejected Stale remain success-channel
outcomes that redirect. `TransactionWorkflowInputError` means no workflow was
constructed and therefore no Started fact was published. Borrow follows Classic:
the guard Replace-navigates to the immutable entry's base route, releases the
Flow Session, and preserves Entry Intent; it does not render a dead-end Steps
setup-error Retry. Failures published by a constructed workflow remain retryable.

The root `index.ts` collaboration contract retains the Start Atom and published
intake types, but no Borrow Flow outcome Atom or outcome types. Start narrows
from a caller-selected intake-plus-navigation command to immutable intake alone.
The Atom-owned store and facade, private React route adapters, and internal file
layout may be replaced together behind that interface; orchestration and Atom
adapters adopt the same private folder shape established by Classic.

The flow renders action-specific amount copy: Borrow review and completion use
“Borrow amount”, while Repay uses “Repay amount”, in both English and French
translations.

The intentional behavior changes include service-derived Start navigation,
authoritative completion validation in Finish, explicit loading instead of
fabricated Workflow state during acquisition, exact Market Position route
identity, Classic-compatible setup-failure redirect, action-specific amount
copy, and replacement of Borrow outcomes by Widget Domain Events. Fresh epochs,
ownership and configuration behavior, terminal-action rejection, destinations,
completion retry timing, and the rendered journey otherwise remain unchanged.
