# 13 — Route classic transaction operations through YieldOperations

**What to build:** Replace broad Yield backend access in Classic Transaction Flow and Transaction Workflow with a narrow operation capability covering Action Preview, submission, and status polling.

**Blocked by:** 01 — Share Yield positions through the first Authoritative Resource.

**Status:** implemented

- [x] `YieldOperations` exposes only the operation and workflow calls required by classic transaction intent owners.
- [x] Action Preview remains owned by the Review scope and transaction status remains owned by Transaction Workflow rather than becoming shared cache resources.
- [x] Submission and polling preserve their typed errors, retries, interruption, and scoped lifetime.
- [x] Successful operations publish semantic position, balance, and activity invalidation at the correct completion points.
- [x] Feature commands remain synchronous Atom dispatch boundaries and do not call an Effect runtime directly.
- [x] Classic flow and workflow code no longer imports the broad Yield backend service.
- [x] Operation adapter, flow, workflow, invalidation, lint, and type-check validation pass.
