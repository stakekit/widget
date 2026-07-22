# 02 — Build the scoped headless Solana runtime

**What to build:** Provide a scoped, non-React Solana runtime that constructs the RPC connection and maintains the available adapter descriptors with the discovery, readiness, fallback, mobile, and cleanup behavior required by the widget.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] The runtime constructs one Solana Connection per Wallet Runtime with behavior equivalent to the existing provider configuration.
- [ ] The runtime uses the modern Wallet Standard registry and does not rely on the deprecated `navigator.wallets` registration path.
- [ ] Compatible wallets present at startup and wallets registered later are wrapped and published as adapter descriptors.
- [ ] Registry unregister events remove and dispose the corresponding wrapped adapters according to the Wallet Standard contract.
- [ ] Adapter readiness events update descriptors, and unsupported adapters are excluded.
- [ ] Same-name Standard adapters take precedence over inactive explicit fallbacks without producing duplicate wallet entries.
- [ ] Explicit Phantom, Trust, and WalletConnect fallbacks are instantiated once per scoped runtime.
- [ ] Android Mobile Wallet Adapter inclusion matches the existing environment, installed-wallet, endpoint, and app-identity behavior.
- [ ] All registry listeners, adapter listeners, wrappers, fallbacks, and mobile resources are released with the runtime scope.
- [ ] Production imports of Wallet Standard or adapter packages are declared as direct package dependencies.
- [ ] Deterministic tests cover initial discovery, late registration, unregister disposal, readiness, deduplication, unsupported filtering, Android behavior, and remount cleanup without real wallets or RPC traffic.
- [ ] This expand step does not yet replace the production Wagmi Solana connector path.
