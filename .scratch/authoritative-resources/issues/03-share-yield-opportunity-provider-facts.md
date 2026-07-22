# 03 — Share Yield opportunity and provider facts

**What to build:** Give individual Yield opportunities and providers one authoritative cache owner so ordinary lookup, initialization, details, and enrichment consumers reuse the same canonical decoded facts.

**Blocked by:** 01 — Share Yield positions through the first Authoritative Resource.

**Status:** implemented

- [x] Ordinary and initial Yield lookup paths use one request identity when they represent the same remote fact.
- [x] Provider lookups are named resources with explicit provider identity and typed missing-provider behavior.
- [x] Initialization and feature-specific interpretation remain projections outside canonical resource storage.
- [x] Equivalent concurrent and sequential consumers share acquisition, fresh state, retry, and failure state.
- [x] Raw generated-client response types and errors do not cross either resource interface.
- [x] Replaced feature-local Yield and provider fetch owners are removed.
- [x] Contract, adapter, feature integration, lint, and type-check validation pass.
