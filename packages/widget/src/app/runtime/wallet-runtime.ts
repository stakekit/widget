import { Effect, Layer } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { BorrowTransactionFlowService } from "../../features/borrow-transaction-flow/state/orchestration/borrow-transaction-flow-service";
import { ClassicTransactionFlowService } from "../../features/classic-transaction-flow/state/orchestration/classic-transaction-flow-service";
import { YieldEntrySubmissionService } from "../../features/yield-entry/state/orchestration/yield-entry-submission-service";
import type { BorrowOperations } from "../../services/api/borrow-operations";
import type { BorrowResourceSource } from "../../services/api/borrow-resource-source";
import type { LegacyResourceSource } from "../../services/api/legacy-resource-source";
import type { YieldOperations } from "../../services/api/yield-operations";
import type { YieldResourceSource } from "../../services/api/yield-resource-source";
import type { WidgetConfigService } from "../../services/config/widget-config";
import type { RichErrorService } from "../../services/errors/rich-error-service";
import type { WidgetNavigation } from "../../services/navigation/widget-navigation";
import type { WidgetPersistence } from "../../services/persistence/widget-persistence";
import type { TrackingService } from "../../services/tracking/tracking-service";
import { WalletAccountSetupService } from "../../services/wallet/wallet-account-setup-service";
import type { WalletModal } from "../../services/wallet/wallet-modal";
import { WalletService } from "../../services/wallet/wallet-service";
import { TransactionWorkflowOperationsService } from "../../services/workflow/transaction-workflow-operations-service";
import { TransactionWorkflowService } from "../../services/workflow/transaction-workflow-service";
import { appRuntime } from "./app-runtime";
import { DeepLinkCoordinator } from "./deep-link-coordinator";

type AppServices =
  | BorrowOperations
  | BorrowResourceSource
  | LegacyResourceSource
  | RichErrorService
  | TrackingService
  | WalletModal
  | WidgetNavigation
  | WidgetConfigService
  | WidgetPersistence
  | YieldOperations
  | YieldResourceSource;

const appServicesAtom = appRuntime.atom(Effect.context<AppServices>());

export const walletRuntime = Atom.runtime((get) => {
  const appLayer = Layer.unwrap(
    get
      .result(appServicesAtom)
      .pipe(Effect.map((services) => Layer.succeedContext(services)))
  );
  const walletLayer = WalletService.defaultLayer.pipe(Layer.provide(appLayer));
  const walletAccountSetupLayer = WalletAccountSetupService.layer.pipe(
    Layer.provide(Layer.merge(appLayer, walletLayer))
  );
  const transactionWorkflowLayer = TransactionWorkflowService.layer.pipe(
    Layer.provide(
      TransactionWorkflowOperationsService.layer.pipe(
        Layer.provide(Layer.mergeAll(appLayer, walletLayer))
      )
    )
  );
  const classicTransactionFlowLayer = ClassicTransactionFlowService.layer.pipe(
    Layer.provide(
      Layer.mergeAll(appLayer, walletLayer, transactionWorkflowLayer)
    )
  );
  const borrowTransactionFlowLayer = BorrowTransactionFlowService.layer.pipe(
    Layer.provide(
      Layer.mergeAll(appLayer, walletLayer, transactionWorkflowLayer)
    )
  );
  const yieldEntrySubmissionLayer = YieldEntrySubmissionService.layer.pipe(
    Layer.provide(
      Layer.mergeAll(appLayer, walletLayer, walletAccountSetupLayer)
    )
  );
  const deepLinkCoordinatorLayer = DeepLinkCoordinator.layer.pipe(
    Layer.provide(
      Layer.mergeAll(appLayer, walletLayer, classicTransactionFlowLayer)
    )
  );

  return Layer.mergeAll(
    appLayer,
    walletLayer,
    walletAccountSetupLayer,
    transactionWorkflowLayer,
    borrowTransactionFlowLayer,
    classicTransactionFlowLayer,
    deepLinkCoordinatorLayer,
    yieldEntrySubmissionLayer
  ).pipe(Layer.fresh);
});
