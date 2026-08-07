# 08 — Migrate Activity Resume and unified flow lifetime

**What to build:** Replace Activity selection as a parallel transaction authority with the Activity Resume Classic Flow variant, and make every variant obey one route, Wallet Scope, runtime-generation, replacement, and unmount lifetime.

**Blocked by:** 05 — Build the Effect and Atom Classic Flow facade.

**Status:** ready-for-agent

- [ ] Selecting an existing activity Yield Action starts an Executable Activity Resume flow with a new injected Classic Transaction Flow Identity.
- [ ] Activity Resume never requests a new Action preview for its existing Yield Action.
- [ ] Back retains the same Activity Resume identity and Yield Action; a later Continue produces declarative steps navigation for that same flow.
- [ ] Starting any Classic Flow atomically replaces the previous active variant, including replacement between Activity Resume and Enter, Exit, or Manage.
- [ ] The active flow survives ordinary props updates, live rerenders, and bundled rerender.
- [ ] Route exit, Wallet Scope disconnect or owner change, application-runtime generation replacement, and widget unmount abandon the targeted active flow through Atom/Effect lifecycle ownership.
- [ ] Stale lifecycle finalization cannot clear a newer flow, and additional-address-only changes do not invalidate Wallet Scope ownership.
- [ ] React route adapters mount lifecycle Atoms and render view state; they do not coordinate cleanup or workflow transitions through `useEffect`.
- [ ] Unit, DOM, and browser tests cover activity selection, review, Back/Continue identity retention, replacement by other variants, every lifecycle boundary, and existing activity behavior.
- [ ] This migration remains on the shared integration branch until ticket 10 completes the atomic cutover.
