# Borrow Transaction Flow architecture

Borrow Transaction Flow owns the routed Review, Steps, and Complete journey.
Every Start captures an immutable intake, Wallet Scope, and monotonic session
epoch. Review owns Borrow action creation; entering execution creates a fresh
shared Transaction Workflow module for the created action.

The Flow publishes read-only `ExecutionStarted` and `Done` outcomes. The Borrow
feature observes them through its own Atom binding: execution start resets the
staged action form, while Done also resets dashboard selection. The flow never
imports `features/borrow`, and leaving Review before execution preserves the
Borrow-owned form state.

Navigation is an Atom outcome rendered by route adapters. Re-entering Review
after execution clears the private action handoff, so browser history cannot
restart a disposed workflow. Only the current session epoch may publish
routing, form-reset, or completion outputs; transaction-truth work remains
owned by the scoped Transaction Workflow.
