import { Effect, Option, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import { walletRuntime } from "../../../runtime/wallet-runtime";
import { WalletService } from "../../../services/wallet/wallet-service";
import { disconnectedLedgerConnectorState } from "../../../services/wallet/wallet-state";

const walletStateAtom = walletRuntime
  .atom(
    WalletService.use((wallet) => Effect.succeed(wallet.states)).pipe(
      Stream.unwrap
    )
  )
  .pipe(Atom.withLabel("walletStateAtom"));

export const walletStateResultAtom = Atom.make((get) =>
  get(walletStateAtom).pipe(AsyncResult.map((state) => state.connection))
).pipe(Atom.withLabel("walletStateResultAtom"));

const walletLedgerStateResultAtom = Atom.make((get) =>
  get(walletStateAtom).pipe(AsyncResult.map((state) => state.ledger))
).pipe(Atom.withLabel("walletLedgerStateResultAtom"));

export const walletConfigResultAtom = walletRuntime
  .atom(WalletService.use((wallet) => Effect.succeed(wallet.wagmiConfig)))
  .pipe(Atom.withLabel("walletConfigResultAtom"));

export const walletEnabledNetworksResultAtom = walletRuntime
  .atom(WalletService.use((wallet) => Effect.succeed(wallet.enabledNetworks)))
  .pipe(Atom.withLabel("walletEnabledNetworksResultAtom"));

export const walletExternalProviderChainsEnabledResultAtom = walletRuntime
  .atom(
    WalletService.use((wallet) =>
      Effect.succeed(wallet.externalProviderChainsEnabled)
    ).pipe(Stream.unwrap)
  )
  .pipe(Atom.withLabel("walletExternalProviderChainsEnabledResultAtom"));

/** The Ledger connector's state; disconnected until the wallet is known. */
export const walletLedgerStateAtom = Atom.make((get) =>
  get(walletLedgerStateResultAtom).pipe(
    AsyncResult.value,
    Option.getOrElse(() => disconnectedLedgerConnectorState)
  )
).pipe(Atom.withLabel("walletLedgerStateAtom"));

/** Whether the wagmi config has loaded. */
export const walletConfigReadyAtom = Atom.make((get) =>
  Option.isSome(AsyncResult.value(get(walletConfigResultAtom)))
).pipe(Atom.withLabel("walletConfigReadyAtom"));
