# 17 — Contract the broad Legacy backend service

**What to build:** Remove the broad Legacy service after every scan, token, price, reward, gas-balance, and bootstrap query uses `LegacyResourceSource`.

**Blocked by:** 02 — Share wallet token-balance scans; 05 — Share Earn token discovery; 08 — Share flow balance facts; 09 — Share prices and reward summaries; 12 — Move enabled-network bootstrap behind the Legacy read capability.

**Status:** implemented

- [x] No production caller imports or resolves the broad Legacy backend service.
- [x] Runtime composition provides one narrow Legacy read-source capability backed by the private generated client.
- [x] Generated Legacy client types remain private to transport and adapter infrastructure.
- [x] The broad service contract, constructor, layer, and duplicated response adaptations are removed.
- [x] Legacy-backed resource and Wallet Bootstrap tests pass against final composition.
- [x] Widget lint, type checking, focused suites, and hygiene checks pass.
