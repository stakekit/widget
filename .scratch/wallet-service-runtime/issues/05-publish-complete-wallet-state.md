# 05 — Publish complete canonical Wallet State

**What to build:** Extend the service-owned event loop so WalletService publishes complete, atomic Wallet State—including connector chains, Ledger data, Cosmos routing, and additional addresses—while feature atoms become read-only Wallet Projections.

**Blocked by:** 03 — Make the service-owned Wagmi config authoritative.

**Status:** ready-for-agent

- [ ] Canonical Wallet State includes the existing connection status, address, chain, network, connector, connector chains, Ledger account state, placeholder state, and validated additional addresses.
- [ ] Cosmos chain-wallet and other connector-specific command-routing objects remain private service context rather than public Wallet Projection fields.
- [ ] Connection and enrichment events are serialized so consumers observe complete snapshots rather than mixed old/new account, chain, or additional-address data.
- [ ] Recoverable connector-chain, Ledger, Cosmos, or additional-address failures degrade only their relevant slice and do not terminally fail a healthy Wallet Runtime.
- [ ] State changes are deduplicated and available through the service's current snapshot and changes stream.
- [ ] Existing wallet selectors, hooks, workflows, and Wallet Scope derivation retain their observable behavior through read-only adapters.
- [ ] Feature atoms cannot write canonical Wallet State or bind a projected value back into WalletService.
- [ ] Service contract tests drive controlled connection and enrichment events and assert only complete public snapshots plus required private command-routing outcomes.
- [ ] Obsolete state-owner tests are replaced by service and projection contract coverage while low-level protocol driver tests remain intact.
