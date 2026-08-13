# Transaction Workflow architecture

Transaction Workflow is the shared execution-mechanics module used by Classic
and Borrow Transaction Flows. `TransactionWorkflowService.make` creates one
fresh scoped workflow handle for one immutable `TransactionWorkflowInput`;
equal inputs never share workflow state or execution lifetimes.

Advancement, confirmation, signing, and submission resolve their exact
operation capabilities once during Transaction Workflow service construction.
No aggregate operations adapter sits between those leaves and their capability
ports; each leaf maps capability failures into workflow-specific states and
errors.

The scoped handle exposes a read-only state Stream and serialized semantic
commands. The enclosing Classic or Borrow Execution scope alone acquires,
interrupts, and disposes that handle, so escaped capabilities cannot retain,
acquire, or revive the machine. Input validation fails service acquisition;
sign, submission, confirmation, and advancement failures remain workflow
states and are retried through the handle's command interface.

This module does not own journey navigation, UI projections, Flow Session
handoffs, or completion policy. Those belong to the Classic and Borrow feature
modules. Submission tracking remains a transaction-truth effect within the
scoped workflow. Successful construction publishes `TransactionWorkflowStarted`,
and the scoped handle finalizer publishes exactly one `TransactionWorkflowEnded`.
Application projections consume those facts for invalidation and
Post-Transaction Reconciliation without delaying workflow completion or route
exit.
