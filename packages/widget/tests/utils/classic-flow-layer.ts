import { Effect, Layer } from "effect";
import { ClassicTransactionFlowService } from "../../src/features/classic-transaction-flow/state/orchestration/classic-transaction-flow-service";
import { YieldOperations } from "../../src/services/api/operations";
import { TransactionWorkflowService } from "../../src/services/transaction-workflow/transaction-workflow-service";
import { makeTestTracking } from "./services/tracking-service";
import type { makeTestWallet } from "./services/wallet-service";
import type { makeTestNavigation } from "./services/widget-navigation";

type TestNavigation = Effect.Success<ReturnType<typeof makeTestNavigation>>;
type TestWallet = Effect.Success<ReturnType<typeof makeTestWallet>>;

export const makeClassicFlowTestLayer = ({
  navigation,
  wallet,
}: {
  readonly navigation: Effect.Effect<TestNavigation>;
  readonly wallet: Effect.Effect<TestWallet>;
}) => {
  const dependencies = Layer.unwrap(
    Effect.all({
      navigation,
      tracking: makeTestTracking(),
      wallet,
    }).pipe(
      Effect.map(
        ({ navigation: testNavigation, tracking, wallet: testWallet }) =>
          Layer.mergeAll(
            testNavigation.layer,
            tracking.layer,
            testWallet.layer,
            Layer.succeed(
              YieldOperations,
              YieldOperations.of({
                previewAction: () =>
                  Effect.die("Action preview is outside this test boundary"),
              } as never)
            ),
            Layer.succeed(
              TransactionWorkflowService,
              TransactionWorkflowService.of({
                make: () =>
                  Effect.die(
                    "Transaction execution is outside this test boundary"
                  ),
              })
            )
          )
      )
    )
  );

  return Layer.merge(
    dependencies,
    ClassicTransactionFlowService.layer.pipe(Layer.provide(dependencies))
  );
};
