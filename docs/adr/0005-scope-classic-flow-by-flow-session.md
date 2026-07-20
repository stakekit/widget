---
status: accepted
---

# Scope Classic Flow by Flow Session

Classic Transaction Flow state will be owned by a non-`keepAlive` facade created through `Atom.family` for one immutable Flow Session and mounted by a stable Review, Steps, and Complete route boundary. A Widget-runtime intake store assigns each explicit Start a monotonic local generation, including structurally equal intake, but that key is confined to family isolation, targeted store cleanup, and suppression of stale shared-router output; it is not a domain identity carried through commands, failures, navigation outcomes, or Transaction Workflow handoffs.

The session model retains tagged Enter, Exit, Manage, and Activity Resume intake but removes stored Reviewing and Executable phases. Enter, Exit, and Manage attach the Action Preview on Continue and detach it on return to Review, while Activity Resume retains its existing Yield Action; the attached action privately owns Transaction Workflow lifetime.

## Rejected alternatives

- Keying the family by intake alone, because Effect Atom uses structural equality and equal user attempts or overlapping route trees would reuse one facade.
- Removing every generation check, because an animated exiting tree can still target the shared intake store or router after replacement.
- Retaining the global `keepAlive` facade and branded Classic Transaction Flow Identity, because they spread lifetime coordination across otherwise scoped state and duplicate router and action-derived facts with explicit phases.
