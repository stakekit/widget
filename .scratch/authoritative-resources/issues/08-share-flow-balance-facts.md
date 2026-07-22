# 08 — Share flow balance facts

**What to build:** Make single-Yield balances and gas-token balance checks authoritative facts reused by deep links, Review, position details, and completion views without moving workflow ownership into Resources.

**Blocked by:** 01 — Share Yield positions through the first Authoritative Resource; 02 — Share wallet token-balance scans.

**Status:** implemented

- [x] Single-Yield balances use complete Yield and wallet identity and one resource-owned freshness and invalidation policy.
- [x] Gas-token balance requests use explicit Action Command and Wallet Scope-derived identity without reading flow state internally.
- [x] Classic Transaction Flow remains the owner of Action Preview and execution; Resources own only the cacheable balance facts.
- [x] Existing deep-link, Review warning, position-detail, and completion behavior consumes read-only projections.
- [x] Replaced feature and flow-local fetch owners are removed.
- [x] Tests cover sharing across consumers, distinct commands and wallets, empty inputs, failures, invalidation, and execution-scope disposal.
- [x] Adapter, flow integration, lint, and type-check validation pass.
