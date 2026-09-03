import { Effect, Layer, type SubscriptionRef } from "effect";
import { ClassicTransactionFlowService } from "../../src/features/classic-transaction-flow/state/orchestration/classic-transaction-flow-service";
import { YieldOperations } from "../../src/services/api/operations";
import { TransactionWorkflowService } from "../../src/services/transaction-workflow/transaction-workflow-service";
import type { WalletState } from "../../src/services/wallet/wallet-state";
import {
  makeTestTracking,
  type TestTrackingOptions,
} from "./services/tracking-service";
import {
  makeTestWallet,
  type TestWalletBehaviorOptions,
} from "./services/wallet-service";
import {
  makeTestNavigation,
  type TestNavigationOptions,
} from "./services/widget-navigation";

type ClassicFlowTestKitBehavior = Readonly<{
  readonly makeWorkflow?: TransactionWorkflowService["Service"]["make"];
  readonly navigation?: TestNavigationOptions;
  readonly previewAction?: YieldOperations["Service"]["previewAction"];
  readonly tracking?: TestTrackingOptions;
  readonly wallet?: TestWalletBehaviorOptions;
}>;

type ClassicFlowTestKitOptions = ClassicFlowTestKitBehavior &
  (
    | Readonly<{
        readonly initialWalletState: WalletState;
        readonly walletState?: never;
      }>
    | Readonly<{
        readonly initialWalletState?: never;
        readonly walletState: SubscriptionRef.SubscriptionRef<WalletState>;
      }>
  );

const unexpectedClassicFlowCall = <A>(method: string): Effect.Effect<A> =>
  Effect.die(`makeClassicFlowTestKit: unexpected call to ${method}`);

export const makeClassicFlowTestKit = Effect.fn("makeClassicFlowTestKit")(
  function* (options: ClassicFlowTestKitOptions) {
    const navigation = yield* makeTestNavigation(options.navigation);
    const tracking = yield* makeTestTracking(options.tracking);
    const wallet = yield* makeTestWallet(
      options.walletState
        ? { ...options.wallet, state: options.walletState }
        : { ...options.wallet, initialState: options.initialWalletState }
    );
    const dependencies = Layer.mergeAll(
      navigation.layer,
      tracking.layer,
      wallet.layer,
      Layer.succeed(
        YieldOperations,
        YieldOperations.of({
          getTransactionStatus: () =>
            unexpectedClassicFlowCall("YieldOperations.getTransactionStatus"),
          previewAction:
            options.previewAction ??
            (() => unexpectedClassicFlowCall("YieldOperations.previewAction")),
          submitSignedTransaction: () =>
            unexpectedClassicFlowCall(
              "YieldOperations.submitSignedTransaction"
            ),
          submitTransactionHash: () =>
            unexpectedClassicFlowCall("YieldOperations.submitTransactionHash"),
        })
      ),
      Layer.succeed(
        TransactionWorkflowService,
        TransactionWorkflowService.of({
          make:
            options.makeWorkflow ??
            (() =>
              unexpectedClassicFlowCall("TransactionWorkflowService.make")),
        })
      )
    );

    return {
      layer: Layer.merge(
        dependencies,
        ClassicTransactionFlowService.layer.pipe(Layer.provide(dependencies))
      ),
      navigation,
      tracking,
      wallet,
    } as const;
  }
);
