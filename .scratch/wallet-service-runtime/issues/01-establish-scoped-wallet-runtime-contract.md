# 01 — Establish the scoped Wallet Runtime contract

**What to build:** Expand WalletService so one application-runtime generation captures one Wallet Bootstrap Snapshot, constructs one Wagmi config, and exposes the Wallet Runtime Phase, current snapshot, change stream, and authoritative config without disrupting existing wallet consumers.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] WalletService captures the normalized bootstrap configuration, enabled networks, decoded initialization parameters, browser environment, and external-provider presence as one immutable Wallet Bootstrap Snapshot.
- [ ] WalletService constructs Wagmi no more than once for its scoped lifetime and retains one service and config identity.
- [ ] The public service contract exposes Bootstrapping, Ready, BootstrapFailed, and InvariantViolated phases together with current and changing Wallet Projections.
- [ ] Core connection and connector watchers are installed before their seed values are read, and Ready is not published until the initial canonical snapshot is available.
- [ ] Reconnect, mobile fallback, and initial chain switching run as scoped background work after core readiness, retaining their existing ordering and recoverable failure policy.
- [ ] Ordinary wallet-related configuration changes after bootstrap do not rebuild Wagmi or change Wallet Topology.
- [ ] Bootstrap construction failures publish a terminal BootstrapFailed phase without exposing a partially ready runtime.
- [ ] Disposing and remounting the application runtime releases the old resources and constructs a fresh Wallet Runtime.
- [ ] The WalletService contract tests exercise observable phases, snapshots, configuration identity, watcher ordering, background initialization, and cleanup without asserting private queue machinery.
- [ ] Existing wallet consumers continue to work while the new contract exists beside the legacy ownership path.
