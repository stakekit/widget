# 01 — Share Yield positions through the first Authoritative Resource

**What to build:** Establish the Authoritative Resource pattern through a complete Yield positions slice. Earn and Portfolio must read one canonical Wallet Scope-keyed position fact, share one acquisition and cache policy, and keep historical positions available before feature visibility projections.

**Blocked by:** None — can start immediately.

**Status:** implemented

- [x] A narrow `YieldResourceSource` capability provides the aggregate-position read without exposing the broad Yield backend service.
- [x] One named Yield Positions resource owns explicit request identity, acquisition, typed failures, freshness, retry, stale-result suppression, and semantic position invalidation.
- [x] Equivalent Earn and Portfolio requests within one Widget Instance share one acquisition and cached result.
- [x] Earn and Portfolio consume canonical positions through read-only projections and no replaced feature-local fetch owner remains.
- [x] Portfolio totals and grouping retain historical positions even when their yields are not currently selected or visible.
- [x] Resource-contract tests cover exact request sharing, distinct Wallet Scopes, typed failure, invalidation, and registry lifetime.
- [x] A generated-client adapter test proves aggregate-position request and response mapping at the capability seam.
- [x] Focused feature tests and widget lint/type checking pass.
