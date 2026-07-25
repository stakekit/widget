import { Effect, Option, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { Config } from "wagmi";
import { walletRuntime } from "../../../app/runtime/wallet-runtime";
import { WalletService } from "../../../services/wallet/wallet-service";

const walletStateAtom = walletRuntime
  .atom(
    WalletService.use((wallet) => Effect.succeed(wallet.states)).pipe(
      Stream.unwrap
    )
  )
  .pipe(Atom.setIdleTTL(0), Atom.withLabel("walletStateAtom"));

export const currentWalletStateResultAtom = Atom.make((get) =>
  get(walletStateAtom).pipe(AsyncResult.map((state) => state.connection))
).pipe(Atom.withLabel("currentWalletStateResultAtom"));

export const currentWalletLedgerStateAtom = Atom.make((get) =>
  get(walletStateAtom).pipe(AsyncResult.map((state) => state.ledger))
).pipe(Atom.withLabel("currentWalletLedgerStateAtom"));

export const currentWalletConfigResultAtom = walletRuntime
  .atom(WalletService.use((wallet) => Effect.succeed(wallet.wagmiConfig)))
  .pipe(Atom.setIdleTTL(0), Atom.withLabel("currentWalletConfigResultAtom"));

export type WalletConfigResource = {
  readonly data: Config | undefined;
  readonly error: unknown;
  readonly isLoading: boolean;
};

export const walletConfigAtom = Atom.make((get) => {
  const result = get(currentWalletConfigResultAtom);

  return {
    data: result.pipe(AsyncResult.value, Option.getOrUndefined),
    error: result.pipe(AsyncResult.error, Option.getOrUndefined),
    isLoading: AsyncResult.isInitial(result) || result.waiting,
  } satisfies WalletConfigResource;
}).pipe(Atom.withLabel("walletConfigAtom"));
