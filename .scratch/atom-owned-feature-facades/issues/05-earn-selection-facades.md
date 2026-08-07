# 05 — Replace the Earn browsing bridge with capability facades

**What to build:** Users can select tokens, yields, and validators and can search, filter, paginate, and retry through stable Earn capability facades instead of an aggregate React-owned page model.

**Blocked by:** None — can start immediately.

**Status:** complete

- [x] Token, yield, and validator views publish plain values through stable read-only Atoms.
- [x] Search, debounce, filtering, pagination, retry routing, and selection are stable command Atoms.
- [x] Classic and dashboard browsing surfaces consume the capability facades.
- [x] Earn Selection remains the sole source of selection, readiness, and intent decisions.
