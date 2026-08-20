# 02 — Preserve exact values through Earn and Classic Transaction Flows

**Parent:** [Preserve exact financial values through execution](../spec.md)

**What to build:** Carry exact token quantities through Earn selection and Classic Transaction Flow journeys. Pending Action limits, Max behavior, Entry Intent, Action Commands, Flow Session intake, Review, and Complete must use the same executable value without reconstructing it from a rounded number or display string.

**Blocked by:** 01 — Establish exact numeric boundaries.

**Status:** ready-for-agent

- [ ] Pending Action amount bounds decode and remain BigNumber values through eligibility checks and Manage Action Command construction.
- [ ] Pending Action Max behavior compares exact sentinel and bound values without converting them to JavaScript numbers.
- [ ] Token balances, financial limits, prices, fees, and other transaction-relevant Earn values use the canonical exact representation.
- [ ] Earn selection and Entry Intent preserve user-authored BigNumber amounts until the Action Command boundary.
- [ ] Enter, Exit, and Manage Action Commands truncate nonnegative token amounts only when constructing the executable Exact Token Amount.
- [ ] Command validation checks zero, minimum, maximum, and balance constraints after token-decimal truncation.
- [ ] A positive amount smaller than one Base Unit Amount truncates to zero and cannot start a Transaction Flow.
- [ ] Flow Session intake captures exact Action Command values without converting through string or number intermediates.
- [ ] Review displays the executable Action Command amount and Complete displays the submitted or executed amount.
- [ ] Representation rounding never feeds back into Max, eligibility, Action Command, or execution logic.
- [ ] Regression tests preserve a high-precision Pending Action amount from decoded bounds through Manage Review and completion.
- [ ] Regression tests cover Enter and Exit amounts already within token precision, excess-precision truncation, post-truncation limits, and truncation to zero.
- [ ] Existing Classic Transaction Flow routes, KYC, warnings, tracking, public serialization, and copy remain compatible.
- [ ] Focused domain, flow, and DOM tests pass, along with Widget lint and root hygiene when the import graph changes.
