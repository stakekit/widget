import { Effect, Layer } from "effect";
import { ClassicTransactionFlowService } from "../../src/features/classic-transaction-flow/state/orchestration/classic-transaction-flow-service";
import { YieldOperations } from "../../src/services/api/yield-operations";
import {
  WidgetNavigation,
  type WidgetNavigationService,
} from "../../src/services/navigation/widget-navigation";
import { TrackingService } from "../../src/services/tracking/tracking-service";
import { TransactionWorkflowService } from "../../src/services/transaction-workflow/transaction-workflow-service";
import { WalletService } from "../../src/services/wallet/wallet-service";

export const makeClassicFlowTestWalletLayer = ({
  navigation,
  wallet,
}: {
  readonly navigation: WidgetNavigationService;
  readonly wallet: WalletService["Service"];
}) => {
  const dependencies = Layer.mergeAll(
    Layer.succeed(WidgetNavigation, navigation),
    Layer.succeed(WalletService, wallet),
    Layer.succeed(
      YieldOperations,
      YieldOperations.of({
        previewAction: () =>
          Effect.die("Action preview is outside this test boundary"),
      } as never)
    ),
    Layer.succeed(
      TrackingService,
      TrackingService.of({
        trackEvent: () => Effect.void,
        trackPageView: () => Effect.void,
      })
    ),
    Layer.succeed(
      TransactionWorkflowService,
      TransactionWorkflowService.of({
        make: () =>
          Effect.die("Transaction execution is outside this test boundary"),
      })
    )
  );

  return Layer.merge(
    dependencies,
    ClassicTransactionFlowService.layer.pipe(Layer.provide(dependencies))
  );
};
