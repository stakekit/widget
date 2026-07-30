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
started the session. Borrow Entry observes only matching Done outcomes and
resets its entry state. Market Position observes only matching execution
outcomes and clears its staged action. The flow remains independent of Borrow.

Portfolio reads the authoritative Borrow Positions resource directly. It does
not import a Borrow feature facade.

The domain model under `domain/borrow` is grouped by responsibility:
`catalog`, `positions`, `risk`, and `execution`. Root files hold cross-cutting
identities, network, wallet, availability, and decoded response schemas. There
are no domain barrels; callers import the owning module directly.
