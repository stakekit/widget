---
status: accepted
---

# Borrow risk is an explicit domain model

Borrow API responses decode into plain immutable schemas. `BorrowAccountSnapshot` is boundary input only. Application derivation produces a `BorrowPositions` aggregate containing market-local `MarketPosition` values and resolving the `RiskPosition` that governs any catalog market.

A `MarketPosition` contains only one market's balances, pending actions, and local financial metrics. Pool markets for the same integration and network share an account-scoped `RiskPosition`; isolated markets each receive a market-scoped `RiskPosition`. This makes the distinction between what the UI displays per market and what the protocol evaluates for solvency explicit.

`RiskPosition.current` preserves authoritative API risk facts. Account-scoped current risk uses the account snapshot, while isolated current risk uses the market position state. `RiskPosition.assess` accepts semantic compound changes—borrow, repay, supply, withdraw, enable collateral, and disable collateral—and projects the complete known collateral composition with weighted borrowing and liquidation capacity.

Risk projections return either available metrics or a typed unavailable reason.
The Widget presents only available projected metrics; it does not substitute
fallback values or warning copy when projection facts are unavailable.

Known Borrow constraint violations—including liquidity, wallet and position
balances, market debt minimums, and borrow capacity—are warnings on Review
rather than Widget-enforced blockers. A constructible Action Command may
continue so the provider or blockchain can make the authoritative execution
decision. Missing inputs that prevent command construction and an intent with no
actionable amount remain ineligible for Review.

Numeric validity is established at API and semantic-input schemas. Borrow domain objects do not use infinity sentinels or repeat finite-number checks inside application logic. Optional limits and unavailable risk are represented explicitly.

## Consequences

- Existing positions remain market-local for display and actions, even when pool risk spans balances in other markets.
- New selected pool markets can assess existing account exposure without fabricating a Market Position.
- Risk policy and projection math have one public seam instead of scattered getters and utility functions.
- Decoded Borrow schemas remain data; derivation is implemented with pure functions, with only the immutable `RiskPosition.assess` closure attached to the resulting deep domain object.
- Incomplete or conflicting collateral inputs cannot silently become permissive numeric defaults.
- Review carries every known constraint warning while leaving Confirm available.

## Rejected alternatives

- Putting account-wide balances into every Market Position, because that obscures market-local ownership and duplicates unrelated display data.
- Keeping risk getters on a generic `Position` class, because it conflates market-local and solvency scopes.
- Exporting independent risk-total and risk-balance helpers, because callers can combine them inconsistently.
- Using infinity for missing limits, because it turns unavailable knowledge into an apparently valid and permissive number.
- Blocking a constructible Borrow action in the Widget, because provider and
  blockchain execution remain authoritative and may apply newer protocol facts.
