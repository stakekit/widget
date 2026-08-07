# Yield Entry

Yield Entry is the shared pre-execution capability consumed by Earn and
Position Details. Its public `state.ts` entry publishes the Atom facade and
deterministic helpers; its private Effect service is composed only by the
Wallet Runtime.

## Ownership

- `model/` owns amount constraints, validation, CTA projection, Enter Action
  Command preparation, estimated rewards, and the closed submission decision.
- `state/orchestration/` owns the private `YieldEntrySubmissionService`, its
  serialized wallet-connect intent, and its Ledger-account delegation.
- `state/atoms/` adapts reactive consumer input, owns validation-attempt
  presentation state, invokes one wallet service operation, or tail-delegates
  one eligible Enter Action Command to Classic Transaction Flow.

The model has no Effect Atom dependency. The service accepts no Atom, registry,
context, callback, or consumer-owned state.

## Submission decision

The pure resolver preserves this precedence: external-provider or connecting
unavailability, Ledger placeholder, disconnected wallet, invalid entry,
missing preparation, KYC block, then Classic Flow Start. Each dispatch executes
exactly one resulting operation.

Classic Transaction Flow remains private to its feature. Yield Entry starts it
through the public Start command Atom and never imports or receives its Effect
service. KYC refresh is a separate Authoritative Resource command owned by the
Earn or Position Details adapter.

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
