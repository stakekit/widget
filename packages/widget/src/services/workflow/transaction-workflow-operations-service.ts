import { Context, Effect, Layer } from "effect";
import { BorrowApiService } from "../api/borrow-api-service";
import { YieldApiService } from "../api/yield-api-service";
import { TrackingService } from "../tracking/tracking-service";
import { WalletService } from "../wallet/wallet-service";

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

      return {
        getBorrowAction: borrowApi.getAction,
        getClassicStatus: yieldApi.getTransactionStatus,
        getWalletState: wallet.getState,
        signMessage: wallet.signMessage,
        signTransaction: wallet.signTransaction,
        stepBorrowAction: borrowApi.stepAction,
        submitBorrowTransaction: borrowApi.submitTransaction,
        submitClassicHash: yieldApi.submitTransactionHash,
        submitClassicSigned: yieldApi.submitSignedTransaction,
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
