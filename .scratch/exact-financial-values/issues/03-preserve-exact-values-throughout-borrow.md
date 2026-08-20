# 03 — Preserve exact values throughout Borrow

**Parent:** [Preserve exact financial values through execution](../spec.md)

**What to build:** Migrate Borrow financial data and journeys to the canonical exact representation. Borrow Account Snapshot and catalog values must remain exact through Market Position and Risk Position calculations, Withdraw Max and other action preparation, Action Commands, and Review.

**Blocked by:** 01 — Establish exact numeric boundaries.

**Status:** ready-for-agent

- [ ] Borrow financial schemas accept valid string and number wire forms and decode balances, limits, prices, fees, rates, and ratios into BigNumber.
- [ ] Borrow Base Unit Amount fields decode into `bigint` without passing through JavaScript number.
- [ ] Related decimal and Base Unit Amount fields decode independently without precedence or consistency checks.
- [ ] Borrow Account Snapshot remains boundary input, while derived Market Position and Risk Position values use canonical exact types.
- [ ] Borrow catalog availability, minimums, prices, rates, utilization, and fee values no longer depend on finite JavaScript-number schemas.
- [ ] Risk Position calculations use BigNumber operations and retain the configured division precision and rounding behavior.
- [ ] Borrow entry, repayment, supply, withdrawal, collateral, and collateral-toggle preparation use exact balances and limits.
- [ ] Withdraw Max preserves the exact supplied balance through Market Position, action preparation, Action Command, and Review.
- [ ] Executable Borrow token amounts truncate at Action Command construction and validate zero and semantic limits afterward.
- [ ] Review uses the exact executable amount and fee values rather than a rounded display input.
- [ ] Existing Risk Unavailable and known-capacity blocking policies remain unchanged.
- [ ] Regression tests cover unsafe API decimals, string and numeric API forms, exact Withdraw Max, risk-capacity boundaries, post-truncation minimums, and exact Review values.
- [ ] Existing Borrow catalog, position, action preparation, transaction flow, and browser execution behavior remains compatible.
- [ ] Focused Borrow domain, action-preparation, flow, and browser tests pass, along with Widget lint and root hygiene when the import graph changes.
