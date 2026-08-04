# Transaction Workflow architecture

Transaction Workflow is the shared execution-mechanics module used by Classic
and Borrow Transaction Flows. `state.ts` creates one fresh module for one
immutable `TransactionWorkflowInput`; equal inputs never share Atom graphs or
machines.

Advancement, confirmation, signing, and submission resolve their exact
operation capabilities once during Transaction Workflow service construction.
No aggregate operations adapter sits between those leaves and their capability
ports; each leaf maps capability failures into workflow-specific states and
errors.

The module exposes one scoped Atom whose value contains passive read and
serialized command capabilities. That scoped Atom alone acquires, interrupts,
and disposes the workflow handle. Releasing it resets the passive state and
event snapshots and revokes retained commands, so escaped capabilities cannot
retain, acquire, or revive the machine.
Input or runtime acquisition failures remain typed in the state Atom, while
sign, submission, confirmation, and advancement failures remain workflow
states and are retried through the command Atom.

This module does not own journey navigation, UI projections, flow-session
handoffs, or completion policy. Those belong to the Classic and Borrow feature
adapters. Submission tracking remains a transaction-truth effect within the
scoped machine. Successful construction publishes `TransactionWorkflowStarted`,
and the scoped handle finalizer publishes exactly one `TransactionWorkflowEnded`;
resource projections immediately invalidate affected Authoritative Resources
from the latter without delaying workflow completion or route exit. When its
Wallet Scope Owner remains current, the application projection also starts one
Post-Transaction Reconciliation process. It repeats balance and position
invalidation after ten, twenty, thirty, and forty seconds; a newer eligible
request replaces it, and disconnecting or changing its owner cancels it.
Activity and Borrow market invalidation remain immediate-only.
