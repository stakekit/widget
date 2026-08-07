# 03 — Make the service-owned Wagmi config authoritative

**What to build:** Route the React Wagmi boundary and the core connection/connector Wallet Projections through WalletService so the mounted widget uses one authoritative config and one source of reactive base Wallet State.

**Blocked by:** 01 — Establish the scoped Wallet Runtime contract.

**Status:** ready-for-agent

- [ ] Wagmi's React context receives an inert fallback only while WalletService is bootstrapping and then receives the service-owned config by reference.
- [ ] No legacy controller or atom path constructs a second production Wagmi config after this migration.
- [ ] Core connection and connector changes are reduced by WalletService and exposed through read-only feature atoms/selectors.
- [ ] Existing feature hooks and UI observe connection, account, chain, and connector changes without writing canonical Wallet State.
- [ ] Equivalent rerenders and ordinary wallet-setting changes keep the same Wallet Runtime and Wagmi config.
- [ ] A new application-runtime generation constructs a fresh Wallet Runtime and config.
- [ ] Manual connect, disconnect, reconnect, and chain-switch actions continue to operate against the authoritative config.
- [ ] The browser contract verifies fallback-to-authoritative handoff, config identity, RainbowKit-facing actions, and read-only projection reactivity.
- [ ] Legacy enrichment and command bridges may remain temporarily only where later tickets still require them, and the test suite remains green.
