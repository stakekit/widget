# 08 — Integrate dynamic Solana membership into Wagmi

**What to build:** Integrate the headless Solana runtime with the fixed Wallet Topology so dynamic Standard discovery and readiness update the existing Wagmi config and RainbowKit-facing hooks without hot-swapping an active adapter.

**Blocked by:** 02 — Build the scoped headless Solana runtime; 03 — Make the service-owned Wagmi config authoritative; 04 — Own External Provider Snapshot synchronization and invariants.

**Status:** ready-for-agent

- [ ] WalletService supplies the headless runtime's Connection and initial Solana adapters when it constructs the one Wagmi config.
- [ ] The React Solana provider, Solana root input, layout-effect bridge, nullable connection race, and unsafe connection cast are removed from the production bootstrap path.
- [ ] A same-name Standard adapter replaces an inactive fallback without rebuilding the Wagmi config.
- [ ] Standard registration while the fallback is active is deferred, and disconnecting that fallback publishes the pending Standard adapter.
- [ ] Unregistering a pending Standard adapter keeps the active fallback; unregistering an inactive visible Standard adapter publishes the fallback.
- [ ] Unregistering an active Standard adapter disconnects and removes it before publishing the fallback.
- [ ] Readiness changes publish a fresh outer connector wrapper while preserving UID, emitter, methods, and underlying adapter identity.
- [ ] Core connector observers and React `useConnectors` consumers both observe membership and readiness changes.
- [ ] Volatile Wagmi connector-store access is encapsulated behind one service-owned membership adapter.
- [ ] External-provider Connector Mode does not accidentally acquire or expose unrelated Solana connectors.
- [ ] Browser characterization covers the prototype transition rules, same-UID readiness refresh, authoritative config identity, and RainbowKit-facing visibility.
- [ ] Runtime disposal removes discovery and readiness listeners without affecting a later remount.
