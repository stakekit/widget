import { Context, Effect, Layer } from "effect";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { isBorrowNetwork } from "../../domain/borrow/network";
import { BorrowApiService } from "../api/borrow-api-service";
import { YieldApiService } from "../api/yield-api-service";
import { resourceInvalidationKeys } from "../resource-invalidation";
import { TrackingService } from "../tracking/tracking-service";
import { WalletService } from "../wallet/wallet-service";
import type { TransactionWorkflowInput } from "./transaction-workflow-model";

export const getTransactionWorkflowInvalidationKeys = (
  input: TransactionWorkflowInput
): ReadonlyArray<unknown> => {
  const scope = input.walletScope;

  const keys: unknown[] = [
    ...resourceInvalidationKeys.walletBalances(scope),
    ...resourceInvalidationKeys.yieldPositions(scope),
    ...resourceInvalidationKeys.activity(scope),
  ];

  if (input._tag === "Borrow" && isBorrowNetwork(scope.network)) {
    keys.push(
      ...resourceInvalidationKeys.borrowPositions(scope),
      ...resourceInvalidationKeys.borrowMarkets(scope.network)
    );
  }

  return keys;
};

export const getTransactionWorkflowSubmissionInvalidationKeys = (
  input: TransactionWorkflowInput
): ReadonlyArray<unknown> => {
  const scope = input.walletScope;
  if (input._tag === "Classic") {
    return [
      ...resourceInvalidationKeys.walletBalances(scope),
      ...resourceInvalidationKeys.yieldPositions(scope),
      ...resourceInvalidationKeys.activity(scope),
    ];
  }

  if (!isBorrowNetwork(scope.network)) {
    return [];
  }

  return [
    ...resourceInvalidationKeys.borrowPositions(scope),
    ...resourceInvalidationKeys.borrowMarkets(scope.network),
  ];
};

export class TransactionWorkflowOperationsService extends Context.Service<TransactionWorkflowOperationsService>()(
  "stakekit/widget/workflow/TransactionWorkflowOperationsService",
  {
    make: Effect.gen(function* () {
      const [borrowApi, tracking, wallet, yieldApi] = yield* Effect.all([
        BorrowApiService,
        TrackingService,
        WalletService,
        YieldApiService,
      ]);
      const reactivity = yield* Reactivity.Reactivity;

      return {
        completeWorkflow: (input: TransactionWorkflowInput) =>
          reactivity.withBatch(
            reactivity.invalidate(getTransactionWorkflowInvalidationKeys(input))
          ),
        getBorrowAction: borrowApi.getAction,
        getClassicStatus: yieldApi.getTransactionStatus,
        getWalletState: wallet.state.pipe(
          Effect.map((state) => state.connection)
        ),
        signMessage: wallet.signMessage,
        signTransaction: wallet.signTransaction,
        stepBorrowAction: borrowApi.stepAction,
        submitBorrowTransaction: borrowApi.submitTransaction,
        submitClassicHash: yieldApi.submitTransactionHash,
        submitClassicSigned: yieldApi.submitSignedTransaction,
        submitWorkflow: (input: TransactionWorkflowInput) =>
          reactivity.withBatch(
            reactivity.invalidate(
              getTransactionWorkflowSubmissionInvalidationKeys(input)
            )
          ),
        trackEvent: tracking.trackEvent,
      };
    }),
  }
) {
  static readonly layer = Layer.effect(
    TransactionWorkflowOperationsService,
    TransactionWorkflowOperationsService.make
  );
}
