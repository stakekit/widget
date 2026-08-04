import { Effect, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { walletRuntime } from "../../../app/runtime/wallet-runtime";
import { WalletService } from "../../../services/wallet/wallet-service";

const walletStateAtom = walletRuntime
  .atom(
    WalletService.use((wallet) => Effect.succeed(wallet.states)).pipe(
      Stream.unwrap
    )
  )
  .pipe(Atom.withLabel("walletStateAtom"));

export const currentWalletStateResultAtom = Atom.make((get) =>
  get(walletStateAtom).pipe(AsyncResult.map((state) => state.connection))
).pipe(Atom.withLabel("currentWalletStateResultAtom"));

export const currentWalletLedgerStateAtom = Atom.make((get) =>
  get(walletStateAtom).pipe(AsyncResult.map((state) => state.ledger))
).pipe(Atom.withLabel("currentWalletLedgerStateAtom"));

export const currentWalletConfigResultAtom = walletRuntime
  .atom(WalletService.use((wallet) => Effect.succeed(wallet.wagmiConfig)))
  .pipe(Atom.withLabel("currentWalletConfigResultAtom"));

export const currentWalletEnabledNetworksResultAtom = walletRuntime
  .atom(WalletService.use((wallet) => Effect.succeed(wallet.enabledNetworks)))
  .pipe(Atom.withLabel("currentWalletEnabledNetworksResultAtom"));
