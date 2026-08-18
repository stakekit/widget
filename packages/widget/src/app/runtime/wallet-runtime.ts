import { Effect, Layer } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { BorrowTransactionFlowService } from "../../features/borrow-transaction-flow/runtime";
import { ClassicTransactionFlowService } from "../../features/classic-transaction-flow/runtime";
import { YieldEntrySubmissionService } from "../../features/yield-entry/runtime";
import type { ApiServices } from "../../services/api/runtime";
import type { WidgetConfigService } from "../../services/config/widget-config";
import type { RichErrorService } from "../../services/errors/rich-error-service";
import type { WidgetDomainEvents } from "../../services/events/widget-domain-events";
import type { WidgetNavigation } from "../../services/navigation/widget-navigation";
import type { WidgetPersistence } from "../../services/persistence/widget-persistence";
import type { TrackingService } from "../../services/tracking/tracking-service";
import { TransactionWorkflowService } from "../../services/transaction-workflow/transaction-workflow-service";
import type { WalletBootstrapSource } from "../../services/wallet/wallet-bootstrap-source";
import type { WalletModal } from "../../services/wallet/wallet-modal";
import { WalletService } from "../../services/wallet/wallet-service";
import { appRuntime } from "./app-runtime";
import { DeepLinkCoordinator } from "./deep-link-coordinator";

type AppServices =
  | ApiServices
  | RichErrorService
  | WidgetDomainEvents
  | TrackingService
  | WalletBootstrapSource
  | WalletModal
  | WidgetNavigation
  | WidgetConfigService
  | WidgetPersistence;

const appServicesAtom = appRuntime.atom(Effect.context<AppServices>());

export const walletRuntime = Atom.runtime((get) => {
  const appLayer = Layer.unwrap(
    get
      .result(appServicesAtom)
      .pipe(Effect.map((services) => Layer.succeedContext(services)))
  );
  const walletLayer = WalletService.defaultLayer.pipe(Layer.provide(appLayer));
  const transactionWorkflowLayer = TransactionWorkflowService.layer.pipe(
    Layer.provide(Layer.merge(appLayer, walletLayer))
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
    Layer.provide(Layer.mergeAll(appLayer, walletLayer))
  );
  const deepLinkCoordinatorLayer = DeepLinkCoordinator.layer.pipe(
    Layer.provide(
      Layer.mergeAll(appLayer, walletLayer, classicTransactionFlowLayer)
    )
  );

  return Layer.mergeAll(
    appLayer,
    walletLayer,
    transactionWorkflowLayer,
    borrowTransactionFlowLayer,
    classicTransactionFlowLayer,
    deepLinkCoordinatorLayer,
    yieldEntrySubmissionLayer
  ).pipe(Layer.fresh);
});
