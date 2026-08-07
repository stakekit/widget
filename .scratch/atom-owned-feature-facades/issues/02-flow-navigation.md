# 02 — Move Classic and Borrow workflow navigation into atoms

**What to build:** Classic and Borrow Transaction Flow commands navigate directly after their ownership and stale-result checks, so Review, Steps, and Complete transitions no longer depend on React navigation outcomes.

**Blocked by:** 01 — Add runtime navigation through pending-action deep links.

**Status:** complete

- [x] Classic Transaction Flow transitions navigate through the runtime capability.
- [x] Borrow Transaction Flow transitions navigate through the runtime capability.
- [x] React navigation outcome effects and rendering adapters are removed.
- [x] Flow Session and Execution Attempt lifecycle guarantees remain covered by registry-level tests.
