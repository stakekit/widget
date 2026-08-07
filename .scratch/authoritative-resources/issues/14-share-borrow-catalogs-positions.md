# 14 — Share Borrow catalogs and positions

**What to build:** Introduce `BorrowResourceSource` and authoritative resources for integrations, markets, and Wallet Scope positions so all Borrow and Portfolio views share canonical catalog and position facts.

**Blocked by:** 01 — Share Yield positions through the first Authoritative Resource.

**Status:** implemented

- [x] Borrow integration, market, and position reads are exposed through a narrow read-source capability.
- [x] Market pagination and position fan-out are hidden behind resource-owned policies with bounded concurrency.
- [x] Complete network, integration, and Wallet Scope identities prevent incorrect cache sharing.
- [x] Borrow and Portfolio consumers share resource state and retain existing projections and empty states.
- [x] Borrow-market and Borrow-position invalidations affect all relevant variants.
- [x] Former Borrow resource atoms no longer acquire through the broad backend service.
- [x] Contract, adapter, feature integration, invalidation, lint, and type-check validation pass.
