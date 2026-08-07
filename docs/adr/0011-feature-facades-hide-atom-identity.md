---
status: accepted
---

# Feature facades hide Atom identity

Feature facades expose stable read-only view Atoms and writable command Atoms while retaining mutable state and dynamic resource Atom identities privately. Published view values contain no nested Atoms, Atom factories, or retry, pagination, refresh, or command callbacks. A facade resolves the active resource internally and forwards user intent through stable commands, so React reads views and dispatches intent without routing an Atom obtained from one subscription into another.

Deterministic calculations remain plain TypeScript, Authoritative Resources retain canonical read and cache ownership, and feature modules own the reactive composition between them. This refines ADR-0004 and supersedes only ADR-0009's allowance for operational pagination and exact retry-target Atoms to cross the Earn facade; ADR-0009's Earn Selection, readiness, failure, and initialization decisions remain in force.

## Rejected alternatives

- Expose dynamic resource Atoms through view values, because callers then own resource identity and recreate an Atom-to-React-to-Atom binding.
- Publish one callback-rich aggregate view model, because it couples unrelated capabilities, hides command ownership, and makes every consumer subscribe to the aggregate.
