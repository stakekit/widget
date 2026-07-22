# 11 — Share widget health status

**What to build:** Give backend health one authoritative resource owner so maintenance detection observes one typed, policy-controlled fact rather than calling the broad Yield backend service directly.

**Blocked by:** 01 — Share Yield positions through the first Authoritative Resource.

**Status:** implemented

- [x] Health acquisition uses `YieldResourceSource` and exposes a stable typed resource state.
- [x] Polling, freshness, retry, and stale-result behavior are owned by the Health resource.
- [x] Maintenance presentation consumes a zero-logic read-only adapter.
- [x] The former direct health-service call is removed.
- [x] Tests cover healthy, maintenance, transport failure, retry, polling lifecycle, and Widget Instance disposal.
- [x] Focused integration, lint, and type-check validation pass.
