# Borrow feature architecture

Borrow is one feature with two peer journeys:

- `borrow-entry` owns market selection, amount entry, preparation state, and
  the `/borrow` route mount.
- `market-position` owns an existing Market Position's details and actions,
  and the `/borrow/:marketId` route mount.

The journeys never import each other. `ui.ts` publishes their two route
factories, while `state.ts` publishes composition-owned event-projection
lifecycles. Each factory owns its relative route topology and mounts Borrow Transaction Flow with an immutable
`BorrowEntry` or `MarketPosition` entry. The app owns only the surrounding
Dashboard route composition.

Supporting modules point toward neither journey:

- `action-preparation` provides the single `prepareBorrowAction` seam. Its
  private action-specific modules derive projections and aligned review input.
- `positions` adapts authoritative resources for Borrow, while `wallet` derives
  a Borrow view from authoritative Wallet State.
- `amount-input` and `action-feedback` contain intentionally shared
  presentation pieces.

Borrow Entry and Market Position each own an app-runtime lifecycle projection
from `TransactionWorkflowStarted` to a private Entry Intent reset command. Any
workflow start consumes all Entry Intent for its Wallet Scope Owner, independent
of journey or source. Each feature owns one active Entry Intent store whose
complete transient Atom chain has zero idle TTL, so leaving its entry surface
discards intent. Wallet Scope Owner changes reset state directly,
additional-address-only changes preserve it, and neither behavior depends on
event delivery.

Market Position stores only the active route's discriminated editable intent
together with its owner and action identity. The action route derives fresh
defaults when mounted; no pre-navigation staging write or retained
owner-and-action attempt family exists. Position, balance, and risk continue to
resolve from live resources. The composition coordinator owns projection
lifecycle, while this feature owns the event-to-command mapping; the coordinator
does not access Borrow Atoms directly, and Borrow Transaction Flow remains
independent of Borrow.

Portfolio reads the authoritative Borrow Positions resource directly. It does
not import a Borrow feature facade.

The domain model under `domain/borrow` is grouped by responsibility:
`catalog`, `positions`, `risk`, and `execution`. Root files hold cross-cutting
identities, network, availability, and decoded response schemas. There
are no domain barrels; callers import the owning module directly.
