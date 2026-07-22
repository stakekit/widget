# 07 — Share Activity history

**What to build:** Give Activity history one shared demand-driven Pull owner. It emits semantic batches containing actions and the backend total; Activity filter counts use bounded summary requests, and feature enrichment projects the canonical Pull without introducing another pagination stream.

**Blocked by:** 03 — Share Yield opportunity and provider facts.

**Status:** implemented

- [x] Activity request identity includes the semantic wallet owner scope, filters, and ordering; backend offset and continuation remain private stream state rather than caller-provided cache identity.
- [x] Initial Activity acquisition requests only the first backend page and each accepted Pull advances by one backend continuation derived from the response's offset, limit, and total.
- [x] Equivalent Activity consumers share one Pull Atom and accumulated progress; no complete-history resource or in-memory pagination remains.
- [x] Pull emissions carry both the action batch and backend total, replacing pagination side atoms.
- [x] Activity filter counts use bounded summary requests that read backend totals without collecting history.
- [x] Yield and validator enrichment reuse authoritative resources as a projection over the Activity Pull and do not create duplicate lookups or a second pagination stream.
- [x] Activity invalidation affects all relevant variants without eagerly fetching inactive variants.
- [x] Obsolete or disposed requests cannot publish into a newer Activity state.
- [x] Existing Activity display and Activity Resume behavior remain compatible.
- [x] Later-page failure preserves accumulated actions, waiting prevents repeated Pull dispatch, and Refresh restarts from page one using native Atom and Stream behavior.
- [x] Tests prove one initial request, one request per Pull, shared progress, bounded counts, backend-derived continuation, refresh behavior, and absence of eager full-history acquisition.
- [x] Focused contract, integration, and invalidation tests, lint, and type-check validation pass.

## Comments

- Pagination audit against `77802a3c2849416602a0b20280a5b40acb7b6cf1` found that Activity history was product-level incremental pagination and counts were bounded total probes. Eagerly collecting all history and slicing it in memory was a regression.
