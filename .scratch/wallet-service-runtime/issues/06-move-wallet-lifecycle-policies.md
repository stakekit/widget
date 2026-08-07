# 06 — Move wallet lifecycle policies into WalletService

**What to build:** Run wallet connection tracking and unsupported-chain disconnect behavior as scoped WalletService lifecycle policies driven by canonical Wallet State.

**Blocked by:** 03 — Make the service-owned Wagmi config authoritative.

**Status:** ready-for-agent

- [ ] Each distinct supported wallet connection emits the existing connected-wallet tracking event once.
- [ ] Equivalent Wallet State publications do not duplicate tracking.
- [ ] Leaving and later re-entering a connection resets deduplication so a genuinely new connection is tracked.
- [ ] Each distinct unsupported connection is disconnected once with the active connector.
- [ ] Equivalent unsupported snapshots do not trigger duplicate disconnect attempts.
- [ ] Returning to disconnected or supported state resets unsupported-connection deduplication.
- [ ] Tracking and disconnect failures preserve the current recoverable policy and do not poison the Wallet Runtime.
- [ ] Lifecycle effects consume the serialized service-owned Wallet State rather than a separately mounted state-owning atom.
- [ ] Lifecycle fibers and subscriptions stop when the Wallet Runtime scope is disposed.
- [ ] Service-level tests replace legacy lifecycle-owner tests and assert tracking/disconnect behavior through observable collaborators.
