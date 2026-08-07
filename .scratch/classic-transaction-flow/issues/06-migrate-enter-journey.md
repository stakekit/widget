# 06 — Migrate the Enter journey

**What to build:** Move the complete Enter user journey onto the Classic Flow facade, from starting immutable intake through review, Continue, Back, execution, and completion. React must remain a view adapter and the slice must preserve current classic and dashboard behavior.

**Blocked by:** 05 — Build the Effect and Atom Classic Flow facade.

**Status:** ready-for-agent

- [ ] Enter entry points start one Reviewing Classic Transaction Flow through the tagged start command.
- [ ] Enter review consumes a narrow read-only view Atom and normalized pricing and gas-warning projections rather than the legacy request authority.
- [ ] Continue handlers synchronously dispatch the Atom command; React does not await work, run Effects, infer loading locally, or use `useEffect` to navigate.
- [ ] The route adapter renders the declarative navigation outcome only when preparation succeeds for the still-active flow.
- [ ] Returning from Executable to review abandons the old Enter flow and starts a new Reviewing identity with the same immutable intake facts.
- [ ] Continuing the Back-created flow performs a fresh Action preview and attaches a fresh Yield Action.
- [ ] Wallet Scope disconnect or owner change follows existing fallback behavior; casing-only EVM and additional-address-only changes preserve the flow.
- [ ] Tracking and KYC work is initiated by Effect-backed commands at the existing intent or transition boundary with compatible timing and payloads.
- [ ] React code introduced or materially changed by this slice contains only rendering, synchronous intent dispatch, presentation-only local state, and named boundary integration.
- [ ] Unit, DOM, and representative browser tests cover Enter review, loading/failure/retry, Continue, Back, fresh action preparation, steps, completion, routing, and preserved copy.
- [ ] This migration remains on the shared integration branch until ticket 10 completes the atomic cutover.
