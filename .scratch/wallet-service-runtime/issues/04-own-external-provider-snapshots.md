# 04 — Own External Provider Snapshot synchronization and invariants

**What to build:** Make WalletService follow live external-provider values inside the Connector Mode chosen at bootstrap and fail deterministically when host updates would change that mode or produce an impossible connector state.

**Blocked by:** 03 — Make the service-owned Wagmi config authoritative.

**Status:** ready-for-agent

- [ ] External-provider address, chain, supported chains, provider operations, and equivalent live values are read from a service-owned External Provider Snapshot.
- [ ] Live snapshot changes synchronize the external connector and connection without rebuilding Wagmi or rerunning Wallet Bootstrap.
- [ ] An available external address triggers the existing automatic connection behavior without duplicate concurrent attempts.
- [ ] Connector supported-chain, account, and chain notifications are deduplicated and ordered through the WalletService event loop.
- [ ] Connector Mode is fixed from the Wallet Bootstrap Snapshot.
- [ ] External-provider presence changing from absent to present or present to absent enters terminal InvariantViolated.
- [ ] A missing or mismatched external-provider connector in external-provider mode also enters InvariantViolated immediately.
- [ ] Each invariant is logged once, subsequent wallet work fails deterministically, and unrelated application services remain usable.
- [ ] A separate Wallet Runtime generation is unaffected by another generation's invariant violation.
- [ ] Service-level tests cover live value replacement, synchronization, both presence transitions, connector mismatch, log-once behavior, and scoped isolation.
- [ ] The legacy external-provider synchronization owner is no longer mounted after this behavior moves into WalletService.
