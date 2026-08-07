# 04 — Share bounded Yield Directory reads

**What to build:** Replace separate Yield-list fetchers with a canonical directory that completely resolves explicit requested Yield IDs, plus a shared bounded category-summary resource that performs one maximum-size request per category. Provider enrichment remains a projection over the explicit-ID directory.

**Blocked by:** 03 — Share Yield opportunity and provider facts.

**Status:** implemented

- [x] Endpoint-equivalent listing requests resolve through one named resource with complete explicit filter and sort identity.
- [x] Full-result consumers receive all applicable pages rather than an arbitrary first page.
- [x] Available categories use one `offset: 0`, API-maximum-size request per category and do not scan the complete unfiltered Yield catalog.
- [x] Provider enrichment reuses the provider resource, deduplicates provider identities, and has explicit failure and missing-provider semantics.
- [x] Availability, selected, visible, and token-scope behavior remains downstream projection logic.
- [x] No former listing or category atom retains independent acquisition or freshness policy.
- [x] Tests cover equivalent and distinct requests, explicit-ID pagination boundaries, bounded category requests, provider deduplication, failures, and stale-result suppression.
- [x] Adapter, feature integration, lint, and type-check validation pass.
