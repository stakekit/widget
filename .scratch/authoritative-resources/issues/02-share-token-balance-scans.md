# 02 — Share wallet token-balance scans

**What to build:** Replace the separate Earn and Portfolio token scans with one canonical Token Balances resource keyed by complete Wallet Scope and token-scan identity, while preserving each feature's presentation model.

**Blocked by:** 01 — Share Yield positions through the first Authoritative Resource.

**Status:** implemented

- [x] A narrow `LegacyResourceSource` capability exposes the semantically read-only token scan without exposing the broad Legacy backend service.
- [x] One Token Balances resource owns canonical input normalization, empty-input behavior, typed failures, freshness, retry, interruption, and wallet-balance invalidation.
- [x] Equivalent Earn and Portfolio scans share one backend acquisition and canonical result.
- [x] Feature-specific token models are pure projections and cannot create a second request authority.
- [x] Complete Wallet Scope identity prevents results from one wallet or network appearing in another.
- [x] Contract tests cover sharing, empty inputs, duplicate identifiers, distinct scopes, invalidation, and Widget Instance remount.
- [x] Adapter, affected feature, lint, and type-check validation pass.
