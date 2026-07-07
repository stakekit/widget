import { Context, Data, Effect, Layer } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { BorrowApi } from "../../generated/api/borrow";
import { stakeKitEffectApiClientAtom } from "../../providers/effect-atom-runtime/stakekit-api-service";
import {
  BorrowExecutionEventsService,
  BorrowWalletExecutionService,
  borrowWalletExecutionAdapterAtom,
} from "./transaction-execution";

export * from "./transaction-execution";

export class MissingBorrowApiClient extends Data.TaggedError(
  "MissingBorrowApiClient"
)<{
  readonly message: string;
}> {}

export class BorrowApiService extends Context.Service<
  BorrowApiService,
  BorrowApi
>()("stakekit/widget/borrow/BorrowApiService") {}

export const borrowAtomRuntime = Atom.runtime((get) => {
  const apiClient = get(stakeKitEffectApiClientAtom);
  const walletExecutionAdapter = get(borrowWalletExecutionAdapterAtom);

  return Layer.mergeAll(
    apiClient
      ? Layer.succeed(BorrowApiService, apiClient.borrow)
      : Layer.effect(
          BorrowApiService,
          Effect.fail(
            new MissingBorrowApiClient({
              message:
                "Borrow Effect API client was not initialized in the atom runtime.",
            })
          )
        ),
    Layer.succeed(BorrowWalletExecutionService, walletExecutionAdapter),
    BorrowExecutionEventsService.layer
  );
});
