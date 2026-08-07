---
status: accepted
---

# WalletService owns the wallet runtime

Wallet initialization and state were split across keyed atoms, React-fed Solana inputs, and a command service bound back to atom state. `WalletService` will instead own one scoped Wallet Runtime per application-runtime generation: it captures one Wallet Bootstrap Snapshot, constructs Wagmi once, owns a serialized canonical state machine and its resources, and exposes current state plus changes for read-only atom adapters.

Wallet-related configuration is bootstrap-only and later changes do not rebuild Wagmi. External-provider values remain live through a service-owned snapshot, but changing whether an external provider is present violates the fixed Connector Mode and poisons only that Wallet Runtime. Browser-discovered EVM and Solana connectors may change within the existing config without rerunning bootstrap.

Solana discovery will move from React providers to a scoped headless runtime using the modern Wallet Standard registry, explicit Phantom, Trust, WalletConnect, and Android Mobile Wallet Adapter fallbacks, and in-place readiness and membership updates. Legacy `navigator.wallets` discovery will not be preserved, and an active adapter will never be hot-swapped.

## Consequences

- `WalletService` owns bootstrap, Wagmi and connector streams, external-provider synchronization, lifecycle behavior, command routing, tracking integration, and cleanup.
- A single serialized event loop updates private routing context and publishes atomic runtime snapshots with `Bootstrapping`, `Ready`, `BootstrapFailed`, or `InvariantViolated` phases.
- Wallet commands fail immediately before readiness, capture one state snapshot for their duration, and read no atom-owned binding.
- Recoverable connector and enrichment failures degrade only their state slice; bootstrap failures and invariant violations are terminal.
- Wallet atoms become read-only service adapters and selectors. Initialization-key families, controller, binding, lifecycle, connection, connector, Ledger, Cosmos, and additional-address state ownership move out of atoms.
- Published package APIs remain compatible. Ordinary reconnect, mobile fallback, initial switching, tracking, unsupported-chain handling, and remount behavior remain unchanged.

## Rejected alternatives

- Rebuilding Wagmi when dynamic atom keys change, because it couples service lifetime to React/atom publication and permits mixed initialization inputs.
- Keeping canonical wallet state in atoms and binding it into `WalletService`, because commands and UI would retain separate authorities.
- Retaining a React-to-service Solana readiness bridge, because the required connection, discovery, readiness, and cleanup primitives are available headlessly.
