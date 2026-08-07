# 03 — Introduce Yield Summary across read-only journeys

**What to build:** Users see the same provider, reward-token, and semantic yield information across activity, portfolio, Review, and Complete, supplied by one shared Yield Summary capability with normalized loading and failure states.

**Blocked by:** None — can start immediately.

**Status:** complete

- [x] Yield Summary exposes stable read-only view Atoms without nested Atoms, factories, or callbacks.
- [x] Read-only activity, portfolio, Review, and Complete consumers use Yield Summary.
- [x] Loading, unavailable data, and typed failures have consistent projections.
- [x] Existing visible behavior and copy remain unchanged.
