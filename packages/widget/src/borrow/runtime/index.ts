import { Context, Data, Effect, Layer } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { BorrowEffectClient } from "../../providers/api/api-client";
import {
  StakeKitApiService,
  stakeKitApiLayerAtom,
} from "../../providers/effect-atom-runtime/stakekit-api-service";
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
  BorrowEffectClient
>()("stakekit/widget/borrow/BorrowApiService") {}

export class BorrowMutationApiService extends Context.Service<
  BorrowMutationApiService,
  BorrowEffectClient
>()("stakekit/widget/borrow/BorrowMutationApiService") {}

export const borrowAtomRuntime = Atom.runtime((get) => {
  const apiLayer = get(stakeKitApiLayerAtom).pipe(
    Layer.catch(() =>
      Layer.effect(
        StakeKitApiService,
        Effect.fail(
          new MissingBorrowApiClient({
            message:
              "Borrow Effect API client was not initialized in the atom runtime.",
          })
        )
      )
    )
  );
  const walletExecutionAdapter = get(borrowWalletExecutionAdapterAtom);
  const borrowApiLayer = Layer.effect(
    BorrowApiService,
    Effect.map(StakeKitApiService, (api) => api.borrow)
  ).pipe(Layer.provide(apiLayer));
  const borrowMutationApiLayer = Layer.effect(
    BorrowMutationApiService,
    Effect.map(StakeKitApiService, (api) => api.borrowMutations)
  ).pipe(Layer.provide(apiLayer));

  return Layer.mergeAll(
    borrowApiLayer,
    borrowMutationApiLayer,
    Layer.succeed(BorrowWalletExecutionService, walletExecutionAdapter),
    BorrowExecutionEventsService.layer
  );
});
