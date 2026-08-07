---
status: accepted
---

# Scope Classic Flow by Flow Session

Classic Transaction Flow state is owned by one non-`keepAlive` Session module mounted by a stable Review, Steps, and Complete route tree. A Widget-runtime intake store assigns each explicit Start a monotonic local epoch, including structurally equal intake, but that epoch is confined to keyed React remounting, targeted store cleanup, and suppression of stale shared-world outputs such as routing and tracking. It is not a domain identity carried through command inputs, failures, navigation outcomes, resources, or Transaction Workflow handoffs.

The Session retains immutable tagged Enter, Exit, Manage, and Activity Resume intake and only one mutable execution-action handoff. Each Review route mount creates a fresh Review scope that owns Action Preview and forward navigation. Continue promotes the reviewed candidate into the Session handoff. Each Steps-and-Complete route mount creates a fresh Execution scope that captures the handoff, mounts the Transaction Workflow module's dedicated root Atom for the scope's whole lifetime, and owns cancellation navigation. The workflow therefore survives the page-consumer gap between Steps and Complete without making its view projection a lifecycle handle. Entering any later Review scope clears the handoff and permanently ends the previous Execution Attempt.

Session, Review, and Execution use separate narrow scoped capabilities rather than a combined nullable context. All scopes use the existing application Atom registry; no nested registry is introduced. Atom disposal owns asynchronous interruption and cleanup, while the Session handoff makes Review-to-Execution correctness independent of child cleanup ordering.

## Rejected alternatives

- Relying on intake object references plus a `WeakMap` for React keys, because the lifecycle distinction is real and should be explicit in the intake store.
- Removing every epoch check, because an animated exiting tree can still target the shared intake store or router after replacement.
- Keeping Review and Execution in one literal Atom lifetime, because `idleTTL(0)` schedules disposal and cannot guarantee a fresh Review across an immediate unmount/remount.
- Storing a Review-attempt generation in Session state, because route mount identity belongs to the React subtree and a fresh scoped Atom already represents it.
- Retaining the global `keepAlive` facade and branded Classic Transaction Flow Identity, because they spread lifetime coordination across otherwise scoped state and duplicate router and action-derived facts with explicit phases.
