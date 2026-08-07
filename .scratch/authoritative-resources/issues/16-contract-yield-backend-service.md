# 16 — Contract the broad Yield backend service

**What to build:** Remove the generated-client-shaped Yield service and its application-runtime wiring after every Yield fact and operation has moved to an Authoritative Resource or `YieldOperations`.

**Blocked by:** 01 — Share Yield positions through the first Authoritative Resource; 03 — Share Yield opportunity and provider facts; 04 — Share the complete Yield Directory; 06 — Share validator discovery; 07 — Share Activity history; 08 — Share flow balance facts; 10 — Share KYC and Yield history insights; 11 — Share widget health status; 13 — Route classic transaction operations through YieldOperations.

**Status:** implemented

- [x] No production caller imports or resolves the broad Yield backend service.
- [x] Runtime composition provides the Yield read-source and operation capabilities from one private generated-client adapter layer.
- [x] Generated Yield client types remain private to transport and adapter infrastructure.
- [x] The broad service contract, constructor, layer, and dead compatibility helpers are removed.
- [x] Yield resource and operation contract suites pass against the final runtime composition.
- [x] Widget lint, type checking, focused suites, and hygiene checks pass.
