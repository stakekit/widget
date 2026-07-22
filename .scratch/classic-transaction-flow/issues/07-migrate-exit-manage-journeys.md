# 07 — Migrate the Exit and Manage journeys

**What to build:** Move complete Exit and pending-action Manage journeys onto the Classic Flow facade while preserving their distinct review inputs, warnings, routes, tracking, execution, and completion behavior.

**Blocked by:** 05 — Build the Effect and Atom Classic Flow facade.

**Status:** ready-for-agent

- [ ] Exit and Manage entry points start tagged Reviewing flows with immutable variant-specific intake facts.
- [ ] Variant-specific views consume narrow read-only Atoms while shared preview, pricing, gas-warning, Wallet Scope, and lifecycle behavior use normalized facade projections.
- [ ] Continue, loading, typed failure, Retry, and navigation use writable command and view Atoms without React-owned asynchronous orchestration.
- [ ] Returning from Executable Exit or Manage to review creates a new Reviewing identity with the same intake facts and forces a fresh Action preview.
- [ ] The refactor does not inspect, block, compensate for, or model irreversible wallet or submission side effects that may have preceded Back.
- [ ] Tracking and KYC calls remain Effect-backed and preserve existing timing, ordering, payloads, and user-visible state.
- [ ] Existing classic and dashboard routes, Wallet Scope redirects, warnings, steps, completion behavior, and copy remain compatible.
- [ ] Touched React code contains no application logic or unreviewed `useEffect` boundaries.
- [ ] Unit, DOM, and representative browser tests cover both variants through review, Continue, failure/retry, Back, fresh preparation, execution, and completion.
- [ ] This migration remains on the shared integration branch until ticket 10 completes the atomic cutover.
