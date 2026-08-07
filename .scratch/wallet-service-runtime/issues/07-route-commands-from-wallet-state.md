# 07 — Route commands from captured Wallet State

**What to build:** Make every WalletService command route directly from one captured service-owned state/context snapshot, fail immediately when unavailable, and remove the atom-to-service binding lifecycle.

**Blocked by:** 04 — Own External Provider Snapshot synchronization and invariants; 05 — Publish complete canonical Wallet State; 06 — Move wallet lifecycle policies into WalletService.

**Status:** ready-for-agent

- [ ] Transaction signing, message signing, account switching, disconnect, and state reads resolve directly from WalletService-owned state and private routing context.
- [ ] Commands issued during Bootstrapping fail immediately with the appropriate typed failure and never wait on Deferred readiness.
- [ ] Commands issued after BootstrapFailed or InvariantViolated fail immediately and deterministically.
- [ ] An in-flight command continues against the state, controller operations, and connector-specific context captured when it began.
- [ ] A command begun after a Wallet State publication uses the newly published snapshot.
- [ ] EVM, external-provider, Safe, Ledger, Cosmos, Substrate, and miscellaneous routing retain their current success and typed-error behavior.
- [ ] Public command result types continue to distinguish signed payloads from broadcast transaction hashes.
- [ ] WalletBinding, the bind method, Deferred readiness, and the binding atom are removed from production ownership.
- [ ] Command contract tests replace binding-atom tests and cover active-command stability, next-command freshness, phase failures, and representative connector routing.
- [ ] No production command reads feature atom state.
