# Transaction Workflow architecture

Transaction Workflow is the shared execution-mechanics module used by Classic
and Borrow Transaction Flows. `state.ts` creates one fresh module for one
immutable `TransactionWorkflowInput`; equal inputs never share Atom graphs or
machines.

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
adapters. Transaction-truth effects such as submission tracking and resource
invalidation finish within the scoped machine even when a newer routed flow
suppresses an older flow's UI outputs.
