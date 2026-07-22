# 19 — Enforce and verify the final dependency graph

**What to build:** Make Authoritative Resource ownership mechanically durable by rejecting cache-bypassing imports and verifying that the final module graph contains no broad backend-service escape hatch or duplicate remote-data owner.

**Blocked by:** 16 — Contract the broad Yield backend service; 17 — Contract the broad Legacy backend service; 18 — Contract the broad Borrow backend service.

**Status:** implemented

- [x] Module boundaries represent application composition, features, Resources, runtime, services, and domain/shared foundations in the agreed dependency direction.
- [x] Features cannot import read-source capabilities, generated clients, or transport infrastructure.
- [x] Resources cannot import features, React, operation capabilities, generated clients, or transport infrastructure.
- [x] Operation capabilities are imported only by intent-owning command and workflow modules.
- [x] Generated clients are reachable only from private adapter and transport infrastructure.
- [x] Searches and hygiene checks prove there are no broad backend services, duplicate fetch atoms, module-global remote caches, or ad hoc runtimes.
- [x] Architecture documentation matches the enforced graph and names the permitted exceptions.
- [x] Full widget lint, type checking, test suites, build, and hygiene checks pass.
