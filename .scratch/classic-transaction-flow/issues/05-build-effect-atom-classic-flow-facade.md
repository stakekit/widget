# 05 — Build the Effect and Atom Classic Flow facade

**What to build:** Wrap the pure Classic Flow core in one Effect/Atom application interface that owns reactive state, commands, Action preparation, typed asynchronous state, concurrency, lifecycle resources, and declarative navigation outcomes while keeping mutable storage and Yield Action attachment private.

**Blocked by:** 04 — Establish the pure Classic Flow core.

**Status:** ready-for-agent

- [ ] The facade exposes read-only active and narrow view Atoms plus writable start, Continue, Retry, and targeted-abandon command Atoms; mutable storage is private.
- [ ] Effects run through the appropriate existing scoped application or wallet Atom runtime with injected services; the feature creates no ad hoc runtime and calls neither `Effect.runPromise` nor React-owned asynchronous APIs.
- [ ] Action preview, pricing, gas checks, retries, and invalidation use Effect resources exposed through Atom rather than React Query, hook-owned fetching, or Promise caches.
- [ ] Continue owns preparation loading, typed failures, retry eligibility, exactly-once attachment, and a declarative navigation outcome.
- [ ] Repeated Continue intents for one flow coalesce into one in-flight Action preparation; Retry is enabled after failure rather than creating parallel work.
- [ ] Replacement or abandonment interrupts preparation when possible, and identity checks silently discard any stale completion that cannot be interrupted.
- [ ] Action-preview resource identity includes Classic Transaction Flow Identity; price and gas resources may preserve reusable domain keys across flows.
- [ ] Activity Resume can produce the same Continue navigation outcome without previewing or changing its already-Executable phase.
- [ ] Lifecycle Atoms own acquisition, interruption, abandonment, and finalization for route-scoped work; widget-runtime resources remain scoped to their runtime generation.
- [ ] Facade tests drive Atom commands and observations directly, covering loading, failure, retry, coalescing, interruption, stale suppression, cache identity, navigation outcomes, and scope closure without React effect flushing.
