# 09 — Contract legacy wallet ownership and verify compatibility

**What to build:** Remove the superseded controller, atom ownership, React bridge, and prototype paths after all consumers use WalletService, then verify the complete widget remains publicly and architecturally compatible.

**Blocked by:** 06 — Move wallet lifecycle policies into WalletService; 07 — Route commands from captured Wallet State; 08 — Integrate dynamic Solana membership into Wagmi.

**Status:** ready-for-agent

- [ ] No production path retains initialization-key families, controller-owned Wagmi construction, WalletBinding, binding readiness, external-provider synchronization ownership, lifecycle ownership, or connection/connector/Ledger/Cosmos/additional-address state ownership outside WalletService.
- [ ] Feature atoms that remain are read-only Wallet Projections or selectors with no back-binding to the service.
- [ ] React composition retains only required third-party Wagmi/RainbowKit context boundaries and no longer owns Solana discovery or connection construction.
- [ ] Obsolete modules, exports, tests, dependencies, and imports are removed without deleting unrelated user work.
- [ ] The throwaway prototype command and production-branch prototype files are removed after their validated decisions are represented by tests and the specification.
- [ ] Published React component, bundled renderer, style, and existing wallet-facing API contracts remain compatible.
- [ ] Classic and dashboard wallet workflows continue to connect, disconnect, switch chains/accounts, and sign through the service-owned runtime.
- [ ] Ordinary configuration updates retain one Wallet Runtime, while an application-runtime remount receives clean service state and resources.
- [ ] The focused unit, DOM, and browser wallet suites pass.
- [ ] Package lint/type-check, formatting and hygiene checks, public API contracts, and the appropriate broader test suite pass.
- [ ] The final code follows the accepted WalletService ownership ADR and uses the glossary's Wallet Runtime terminology consistently.
