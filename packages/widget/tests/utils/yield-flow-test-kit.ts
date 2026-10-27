import { Effect, Layer, Stream, type SubscriptionRef } from "effect";
import {
  BorrowOperations,
  YieldOperations,
} from "../../src/services/api/operations";
import { EvmRpc } from "../../src/services/evm-rpc/evm-rpc";
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
import { makeTestZamaLayer } from "./services/zama-service";
import { makeTestDomainEvents } from "./transaction-workflow-test-kit";

type YieldFlowTestKitBehavior = Readonly<{
  /** Runs the real workflow engine against this RPC and these API answers. */
  readonly engine?: Readonly<{
    readonly evmRpc: Partial<EvmRpc["Service"]>;
    readonly yieldOperations: Partial<YieldOperations["Service"]>;
  }>;
  readonly makeWorkflow?: TransactionWorkflowService["Service"]["make"];
  readonly navigation?: TestNavigationOptions;
  readonly previewAction?: YieldOperations["Service"]["previewAction"];
  readonly tracking?: TestTrackingOptions;
  readonly wallet?: TestWalletBehaviorOptions;
  readonly zama?: Parameters<typeof makeTestZamaLayer>[0];
}>;

type YieldFlowTestKitOptions = YieldFlowTestKitBehavior &
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

const unexpectedYieldFlowCall = <A>(method: string): Effect.Effect<A> =>
  Effect.die(`makeYieldFlowTestKit: unexpected call to ${method}`);

export const makeYieldFlowTestKit = Effect.fn("makeYieldFlowTestKit")(
  function* (options: YieldFlowTestKitOptions) {
    const navigation = yield* makeTestNavigation(options.navigation);
    const tracking = yield* makeTestTracking(options.tracking);
    const events = yield* makeTestDomainEvents();
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
            unexpectedYieldFlowCall("YieldOperations.getTransactionStatus"),
          getYieldBalances: () =>
            unexpectedYieldFlowCall("YieldOperations.getYieldBalances"),
          previewAction:
            options.previewAction ??
            (() => unexpectedYieldFlowCall("YieldOperations.previewAction")),
          submitSignedTransaction: () =>
            unexpectedYieldFlowCall("YieldOperations.submitSignedTransaction"),
          submitTransactionHash: () =>
            unexpectedYieldFlowCall("YieldOperations.submitTransactionHash"),
          submitTransactionHashInBackground: () =>
            unexpectedYieldFlowCall(
              "YieldOperations.submitTransactionHashInBackground"
            ),
          ...options.engine?.yieldOperations,
        })
      ),
      makeTestZamaLayer(options.zama)
    );
    const engineLayer = (engine: NonNullable<typeof options.engine>) =>
      TransactionWorkflowService.layer.pipe(
        Layer.provide(
          Layer.mergeAll(
            dependencies,
            events.layer,
            Layer.succeed(
              BorrowOperations,
              BorrowOperations.of({} as BorrowOperations["Service"])
            ),
            Layer.succeed(
              EvmRpc,
              EvmRpc.of({
                awaitOutcome: () =>
                  unexpectedYieldFlowCall("EvmRpc.awaitOutcome"),
                broadcast: () => unexpectedYieldFlowCall("EvmRpc.broadcast"),
                explorerUrl: () => null,
                prepare: () => unexpectedYieldFlowCall("EvmRpc.prepare"),
                readAllowance: () =>
                  unexpectedYieldFlowCall("EvmRpc.readAllowance"),
                ...engine.evmRpc,
              })
            )
          )
        )
      );
    const workflow = options.engine
      ? engineLayer(options.engine)
      : Layer.succeed(
          TransactionWorkflowService,
          TransactionWorkflowService.of({
            leaveGuarded: Stream.make(false),
            make:
              options.makeWorkflow ??
              (() =>
                unexpectedYieldFlowCall("TransactionWorkflowService.make")),
          })
        );

    return {
      layer: Layer.merge(dependencies, workflow),
      navigation,
      tracking,
      wallet,
    } as const;
  }
);
