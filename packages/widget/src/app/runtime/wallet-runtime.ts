import { Effect, Layer } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { BorrowOperations } from "../../services/api/borrow-operations";
import type { BorrowResourceSource } from "../../services/api/borrow-resource-source";
import type { LegacyResourceSource } from "../../services/api/legacy-resource-source";
import type { YieldOperations } from "../../services/api/yield-operations";
import type { YieldResourceSource } from "../../services/api/yield-resource-source";
import type { WidgetConfigService } from "../../services/config/widget-config";
import type { RichErrorService } from "../../services/errors/rich-error-service";
import type { WidgetPersistence } from "../../services/persistence/widget-persistence";
import type { TrackingService } from "../../services/tracking/tracking-service";
import { WalletService } from "../../services/wallet/wallet-service";
import { TransactionWorkflowOperationsService } from "../../services/workflow/transaction-workflow-operations-service";
import { TransactionWorkflowService } from "../../services/workflow/transaction-workflow-service";
import { appRuntime } from "./app-runtime";

type AppServices =
  | BorrowOperations
  | BorrowResourceSource
  | LegacyResourceSource
  | RichErrorService
  | TrackingService
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
  const transactionWorkflowLayer = TransactionWorkflowService.layer.pipe(
    Layer.provide(
      TransactionWorkflowOperationsService.layer.pipe(
        Layer.provide(Layer.mergeAll(appLayer, walletLayer))
      )
    )
  );

  return Layer.mergeAll(walletLayer, transactionWorkflowLayer).pipe(
    Layer.fresh
  );
});
