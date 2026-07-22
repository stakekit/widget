# 15 — Route Borrow workflows through BorrowOperations

**What to build:** Replace broad Borrow backend access in Borrow Transaction Flow and Transaction Workflow with an operation capability for action creation, advancement, polling, and submission.

**Blocked by:** 14 — Share Borrow catalogs and positions.

**Status:** implemented

- [x] `BorrowOperations` exposes only the commands and workflow queries required by Borrow intent owners.
- [x] Action creation remains owned by Borrow Review and status polling remains owned by Transaction Workflow.
- [x] Existing missing-configuration, action, transaction, retry, and interruption behavior remains typed and scoped.
- [x] Successful Borrow operations invalidate affected positions and markets without enumerating cache keys.
- [x] Borrow feature and workflow modules no longer import the broad Borrow backend service.
- [x] Operation adapter, transaction-flow, workflow, invalidation, lint, and type-check validation pass.
