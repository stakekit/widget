import { Context, Effect, Layer } from "effect";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { isBorrowNetwork } from "../../domain/borrow";
import { BorrowApiService } from "../api/borrow-api-service";
import { YieldApiService } from "../api/yield-api-service";
import { resourceInvalidationKeys } from "../resource-invalidation";
import { TrackingService } from "../tracking/tracking-service";
import { WalletService } from "../wallet/wallet-service";
import type { TransactionWorkflowKey } from "./transaction-workflow-model";

export const getTransactionWorkflowInvalidationKeys = (
  key: TransactionWorkflowKey
): ReadonlyArray<unknown> => {
  const scope = key.walletScope;

  const keys: unknown[] = [
    ...resourceInvalidationKeys.walletBalances(scope),
    ...resourceInvalidationKeys.yieldPositions(scope),
    ...resourceInvalidationKeys.activity(scope),
  ];

  if (key._tag === "Borrow" && isBorrowNetwork(scope.network)) {
    keys.push(
      ...resourceInvalidationKeys.borrowPositions(scope),
      ...resourceInvalidationKeys.borrowMarkets(scope.network)
    );
  }

  return keys;
};

export const getTransactionWorkflowSubmissionInvalidationKeys = (
  key: TransactionWorkflowKey
): ReadonlyArray<unknown> => {
  const scope = key.walletScope;
  if (key._tag === "Classic") {
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
        completeWorkflow: (key: TransactionWorkflowKey) =>
          reactivity.withBatch(
            reactivity.invalidate(getTransactionWorkflowInvalidationKeys(key))
          ),
        getBorrowAction: borrowApi.getAction,
        getClassicStatus: yieldApi.getTransactionStatus,
        getWalletState: wallet.getState,
        signMessage: wallet.signMessage,
        signTransaction: wallet.signTransaction,
        stepBorrowAction: borrowApi.stepAction,
        submitBorrowTransaction: borrowApi.submitTransaction,
        submitClassicHash: yieldApi.submitTransactionHash,
        submitClassicSigned: yieldApi.submitSignedTransaction,
        submitWorkflow: (key: TransactionWorkflowKey) =>
          reactivity.withBatch(
            reactivity.invalidate(
              getTransactionWorkflowSubmissionInvalidationKeys(key)
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
