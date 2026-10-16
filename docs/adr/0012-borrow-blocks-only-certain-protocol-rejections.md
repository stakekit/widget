# Borrow blocks only certain protocol rejections

The widget disables a Borrow action only when it is sure the protocol rejects
it. Every other known problem is a Borrow Constraint Warning: the user sees it
and may still submit, and the Borrow API and the chain decide.

The Risk Gate is the only widget-side block:

- **Health factor** bounds every risk-increasing change (borrow, withdraw,
  disable collateral). Withdrawing collateral behind any remaining debt,
  including interest dust the API rounds to `$0.00`, projects a health factor
  of 0 and blocks.
- **Max LTV** bounds only changes that add debt. Aave checks LTV on borrow but
  only the health factor on withdraw and collateral disable; Morpho's LLTV and
  health factor are the same limit.
- **Margins**: oracle-anchored (isolated) projections block once past the
  limit by 0.1%, absorbing a snapshot up to a minute old and an LTV the API
  rounds to four places. Display-priced (pooled) projections block once past
  by 5%, absorbing display prices that differ from the protocol oracle.
  Overshoots inside the margin warn.

Full repayment is not blocked when the scanned wallet balance falls short of
the debt. The scan can be stale, and the API rechecks the live balance before
it builds the action.

The cost of this policy is that some doomed submissions reach the API or the
chain. The alternative, blocking on every warning, rejects valid actions
whenever a snapshot, scan, or display price is stale. That fails users without
recourse, while a rejected submission at least tells them why.
