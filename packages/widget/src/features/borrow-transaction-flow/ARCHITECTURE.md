# Borrow Transaction Flow architecture

Borrow Transaction Flow owns the routed Review, Steps, and Complete journey.
Every Start captures an immutable intake, Wallet Scope, and monotonic session
epoch. Its intake contains one prepared Action Command and an action-specific
review summary derived from the same private Borrow preparation facts. The flow
does not reconstruct or reinterpret risk, balances, or form input. Review owns
Borrow action creation from that command; entering execution creates a fresh
shared Transaction Workflow module for the created action.

The Flow publishes read-only `ExecutionStarted` and `Done` outcomes carrying
the immutable `BorrowEntry` or `MarketPosition` entry captured at Start. The
owning Borrow journey observes only its matching outcome: Market Position
clears its staged action at execution start, while Borrow Entry resets entry
state on Done. The flow never imports `features/borrow`, and leaving Review
before execution preserves Borrow-owned state.

Navigation is an Atom outcome rendered by route adapters. Re-entering Review
after execution clears the private action handoff, so browser history cannot
restart a disposed workflow. Only the current session epoch may publish
routing, form-reset, or completion outputs; transaction-truth work remains
owned by the scoped Transaction Workflow.

The Borrow feature starts a session through an application-runtime Atom command
that re-reads the current `Ready` preparation, captures the immutable intake,
and performs navigation. React event handlers dispatch that command without
carrying a prebuilt review or choosing a destination.
