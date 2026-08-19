# Yield Entry

Yield Entry is the shared pre-execution capability consumed by Earn and
Position Details. Its public `index.ts` entry publishes the Atom facade and
deterministic helpers; its separate `runtime.ts` entry publishes the Effect
service for composition by the Wallet Runtime.

## Ownership

- `domain/earn` owns reusable pure Earn rules such as amount constraints.
- `model/` owns validation, CTA projection, Enter Action Command preparation,
  entry-specific formatted projections, and the closed submission decision.
- `state/orchestration/` owns the private `YieldEntrySubmissionService`, its
  serialized wallet-connect intent, and its Ledger-account delegation.
- `state/atoms/` adapts reactive consumer input, owns validation-attempt
  presentation state, invokes one wallet service operation, or tail-delegates
  one eligible Enter Action Command to Classic Transaction Flow.

The model has no Effect Atom dependency. The service accepts no Atom, registry,
context, callback, or consumer-owned state.

Classic Transaction Flow and other consumers do not import Yield Entry for
reusable calculation helpers. Shared read presentation belongs to Yield Summary;
entry interaction presentation belongs to Yield Entry.

The public reactive constructor remains an Atom factory; reactive composition
does not move into a second Effect service. It internally resolves current
Wallet state, Wallet Scope and command identity, relevant Widget Configuration,
the current Yield KYC gate and refresh, and the Yield Summary provider
projection. A consumer supplies only its Entry Intent, available amount,
whether the selected yield already has an active position, mount identity,
validation identity, a Yield Entry Amount Initialization policy, and Yield Entry
Readiness. The readiness alternatives are Loading, Empty, Ineligible,
Refreshing, and Ready; Refreshing retains presentation data but disables
submission. The amount policy is Preserve Intent or Default to Minimum, with
the latter changing only a zero intent when the allowed minimum is positive.
Consumers do not pass full Positions Data or an open set of loading, empty,
fetching, and eligibility booleans.
Readiness governs submission availability only. Infrastructure failures and
retry remain in their authoritative Resource or page projections; `Ineligible`
does not erase or reinterpret them.

## Submission decision

The pure resolver preserves this precedence: external-provider or connecting
unavailability, Ledger placeholder, disconnected wallet, invalid entry,
missing preparation, KYC block, then Classic Flow Start. Each dispatch executes
exactly one resulting operation.

Classic Transaction Flow remains private to its feature. Yield Entry starts it
through the public Start command Atom and never imports or receives its Effect
service. The Yield Entry facade owns use of the KYC Authoritative Resource's
gate and refresh command; entry surfaces do not coordinate that resource.

## Wallet operations and validation state

The submission service is constructed once per Wallet Runtime. One scoped
serializer owns both wallet operations. Each operation records click intent and
compares the triggering Wallet identity with canonical Wallet State before
acting. Connect checks that identity again after opening the modal. A changed
wallet returns a typed stale outcome, while Ledger integration failures remain
in the Effect error channel. `WalletService` owns Ledger connector routing and
account switching; the wallet-owned `WalletAccountSetupService` serializes the
mutation, rejects a changed connector after completion, and closes the wallet
modal only after success.

The Atom facade owns the last submitted validation key. Earn supplies a stable
category/yield/token key; Position Details supplies its stable entry key. Only
an invalid decision records the key, so selection changes reset error
presentation without callbacks or mirrored writable state.
