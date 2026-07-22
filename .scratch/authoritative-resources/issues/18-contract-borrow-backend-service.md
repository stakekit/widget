# 18 — Contract the broad Borrow backend service

**What to build:** Remove the broad Borrow service after all Borrow reads and operations use their separate capability contracts while retaining one private generated-client-backed implementation.

**Blocked by:** 14 — Share Borrow catalogs and positions; 15 — Route Borrow workflows through BorrowOperations.

**Status:** implemented

- [x] No production caller imports or resolves the broad Borrow backend service.
- [x] Runtime composition provides `BorrowResourceSource` and `BorrowOperations` from one private implementation layer.
- [x] Missing Borrow configuration remains a typed capability failure.
- [x] Generated Borrow client types remain private to transport and adapter infrastructure.
- [x] The broad service contract, constructor, layer, and dead compatibility helpers are removed.
- [x] Borrow resource, flow, workflow, lint, type-check, and hygiene validation pass.
