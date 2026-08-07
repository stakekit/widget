# 06 — Share validator discovery

**What to build:** Restore the validator endpoint's distinct semantic contracts: ordinary and search discovery use shared demand-driven Pull resources, preferred validators use an explicit complete resource, and address resolution uses a bounded point resource.

**Blocked by:** 01 — Share Yield positions through the first Authoritative Resource.

**Status:** implemented

- [x] Each validator contract has a minimal complete identity: discovery includes Yield, status, and search inputs; preferred includes its applicable scope; address lookup includes Yield and address. Transport continuation is never part of caller identity.
- [x] Ordinary and search discovery request only the first backend page initially and advance by one backend continuation per accepted Pull.
- [x] Equivalent ordinary or search consumers share the same Pull Atom and accumulated progress; feature projections forward Pull and Refresh instead of creating another stream.
- [x] Validator search advances its name and address branches independently and concurrently, then merges and deduplicates their emitted batches deterministically.
- [x] Preferred validators acquire the complete applicable result explicitly; address resolution remains a bounded point lookup and neither contract is routed through the ordinary Pull.
- [x] Continuation, later-page failure, waiting, and refresh use native Atom and Stream behavior without page caches, manual offsets, locks, or custom refresh coordination.
- [x] Feature code receives semantic validator state rather than raw offsets or generated-client page types.
- [x] Replaced validator fetch implementations are removed.
- [x] Tests prove incremental ordinary/search acquisition, shared progress, independent search continuations, complete preferred acquisition, bounded address lookup, and refresh from page one.
- [x] Focused resource and UI integration tests, lint, and type-check validation pass.

## Comments

- Pagination audit against `77802a3c2849416602a0b20280a5b40acb7b6cf1` found that the endpoint intentionally served incremental, complete, and point consumers. Replacing those contracts with one eager complete directory was a regression.
