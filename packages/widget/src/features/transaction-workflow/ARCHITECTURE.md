# Transaction Workflow architecture

Transaction Workflow is the shared execution-mechanics module used by Classic
and Borrow Transaction Flows. `state.ts` creates one fresh module for one
immutable `TransactionWorkflowInput`; equal inputs never share Atom graphs or
machines.

Only the module's `rootAtom` acquires, interrupts, and disposes the private
workflow handle. The public state Atom, lifecycle-scoped event Atom, and
serialized command Atom cannot acquire or revive a machine without that root.
Input or runtime acquisition failures remain typed in the state Atom, while
sign, submission, confirmation, and advancement failures remain workflow
states and are retried through the command Atom.

This module does not own journey navigation, UI projections, flow-session
handoffs, or completion policy. Those belong to the Classic and Borrow feature
adapters. Transaction-truth effects such as submission tracking and resource
invalidation finish within the scoped machine even when a newer routed flow
suppresses an older flow's UI outputs.
