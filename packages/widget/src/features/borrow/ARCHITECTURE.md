# Borrow feature architecture

Borrow is one feature with two peer journeys:

- `borrow-entry` owns market selection, amount entry, preparation state, and
  the `/borrow` route mount.
- `market-position` owns an existing Market Position's details and actions,
  and the `/borrow/:marketId` route mount.

The journeys never import each other. `ui.ts` is the feature's only public
entry and publishes their two route factories. Each factory owns its relative
route topology and mounts Borrow Transaction Flow with an immutable
`BorrowEntry` or `MarketPosition` entry. The app owns only the surrounding
Dashboard route composition.

Supporting modules point toward neither journey:

- `action-preparation` provides the single `prepareBorrowAction` seam. Its
  private action-specific modules derive projections and aligned review input.
- `positions` and `wallet` adapt authoritative resources for Borrow.
- `amount-input` and `action-feedback` contain intentionally shared
  presentation pieces.

Borrow Transaction Flow publishes outcomes carrying the immutable entry that
started the session. Borrow Entry passively reconciles its authoritative form
state from matching Done outcomes. Market Position passively reconciles its
single attempt-family state from matching Execution Started outcomes; a
matching later Done is durable proof of the same reset when the form was
unobserved between phases. Each attempt is keyed by Wallet owner, network,
market, and semantic action, owns one discriminated editable intent plus one
outcome cursor, and continues resolving Position, balance, and risk from live
resources. Direct routes therefore receive a fresh default without requiring a
global staged attempt. Each state records the handled epoch and phase so the
transition is idempotent. Neither journey uses a subscriber Atom, registry
access, or a React mount to perform that reconciliation, and the flow remains
independent of Borrow.

Portfolio reads the authoritative Borrow Positions resource directly. It does
not import a Borrow feature facade.

The domain model under `domain/borrow` is grouped by responsibility:
`catalog`, `positions`, `risk`, and `execution`. Root files hold cross-cutting
identities, network, wallet, availability, and decoded response schemas. There
are no domain barrels; callers import the owning module directly.
