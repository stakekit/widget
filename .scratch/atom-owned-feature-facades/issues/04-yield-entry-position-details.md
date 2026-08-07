# 04 — Introduce Yield Entry through position details

**What to build:** A user entering or exiting a position receives shared amount constraints, validation, KYC, rewards, Action Command preparation, submission, tracking, flow start, and navigation behavior owned outside React.

**Blocked by:** 01 — Add runtime navigation through pending-action deep links; 03 — Introduce Yield Summary across read-only journeys.

**Status:** complete

- [x] Position details consumes one Yield Entry facade for its complete entry journey.
- [x] React event handlers only normalize events and dispatch synchronous commands.
- [x] RainbowKit modal commands are installed through one runtime-scoped boundary adapter.
- [x] The module-global Ledger modal callback and callback-bearing Ledger command are removed.
- [x] Yield Entry behavior is covered at its public facade seam.
