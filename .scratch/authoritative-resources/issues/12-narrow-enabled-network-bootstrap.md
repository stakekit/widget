# 12 — Move enabled-network bootstrap behind the Legacy read capability

**What to build:** Preserve Wallet Bootstrap network discovery while removing its dependency on the broad Legacy backend service and keeping bootstrap lifetime and failure behavior unchanged.

**Blocked by:** 02 — Share wallet token-balance scans.

**Status:** implemented

- [x] Wallet Bootstrap obtains enabled networks through `LegacyResourceSource` with no broad-service dependency.
- [x] The capability exposes only the query required by bootstrap and returns canonical decoded network data.
- [x] Bootstrap Snapshot, readiness, fallback, and failure semantics remain unchanged.
- [x] No React adapter or feature atom becomes the owner of enabled-network acquisition.
- [x] Service and Wallet Bootstrap tests cover success, failure, runtime replacement, and sequential remount.
- [x] Lint and type-check validation pass.
