# 05 — Share Earn token discovery

**What to build:** Restore the two intentional token-discovery contracts: Yield API results use one shared demand-driven Pull per semantic query, while Legacy token options remain a complete non-paginated resource. The feature chooses the source and projects either result without owning transport pagination.

**Blocked by:** 02 — Share wallet token-balance scans.

**Status:** implemented

- [x] Yield token discovery has complete network and Yield-type identity, requests only the first backend page initially, and advances by one backend continuation per accepted Pull.
- [x] Equivalent Yield token consumers share one Pull Atom and accumulated progress; the feature facade does not create a second stream or paginate a complete array in memory.
- [x] Legacy token options use `LegacyResourceSource` and preserve network-specific behavior.
- [x] Legacy token options remain a complete non-paginated resource and are exposed as immediately done, with no synthetic pages or fake continuation.
- [x] Empty network or filter inputs avoid meaningless I/O where the semantic result is empty.
- [x] Canonical token facts remain independent from selected-token and view presentation state.
- [x] Former feature-local token-option acquisition paths are removed.
- [x] Tests prove one initial Yield page, one request per Pull, shared progress, backend-derived continuation, refresh from page one, and complete Legacy behavior.
- [x] Focused adapter and token-selection tests, lint, and type-check validation pass.

## Comments

- Pagination audit against `77802a3c2849416602a0b20280a5b40acb7b6cf1` found that the Yield branch was incrementally paginated while the Legacy branch intentionally returned a complete list. Eagerly collecting all Yield pages was a regression.
