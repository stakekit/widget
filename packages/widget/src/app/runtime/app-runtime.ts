import { Effect, Layer } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import {
  BorrowApiService,
  LegacyApiService,
  YieldApiService,
} from "../../services/api";
import { ApiTransportService } from "../../services/api/transport";
import {
  type WidgetConfig,
  WidgetConfigService,
} from "../../services/config/widget-config";
import { RichErrorService } from "../../services/errors/rich-error-service";
import { WidgetPersistence } from "../../services/persistence/widget-persistence";
import { TrackingService } from "../../services/tracking/tracking-service";
import { WalletService } from "../../services/wallet/wallet-service";
import { TransactionWorkflowOperationsService } from "../../services/workflow/transaction-workflow-operations-service";
import { TransactionWorkflowService } from "../../services/workflow/transaction-workflow-service";
import { widgetConfigAtom } from "../config";

const makeAppLayer = (
  config: WidgetConfig,
  registry: AtomRegistry.AtomRegistry
) => {
  const widgetConfigLayer = WidgetConfigService.layer({
    initial: config,
    changes: AtomRegistry.toStream(registry, widgetConfigAtom),
    current: Effect.sync(() => registry.get(widgetConfigAtom)),
  });
  const richErrorLayer = RichErrorService.layer.pipe(
    Layer.provide(widgetConfigLayer)
  );
  const apiTransportLayer = ApiTransportService.layer.pipe(
    Layer.provide(richErrorLayer),
    Layer.provide(widgetConfigLayer)
  );
  const apiLayer = Layer.mergeAll(
    BorrowApiService.layer,
    LegacyApiService.layer,
    YieldApiService.layer
  ).pipe(Layer.provide(apiTransportLayer));
  const persistenceLayer = WidgetPersistence.layer;
  const trackingLayer = TrackingService.layer.pipe(
    Layer.provide(widgetConfigLayer)
  );
  const walletLayer = WalletService.layer.pipe(
    Layer.provide(Layer.mergeAll(apiLayer, persistenceLayer, widgetConfigLayer))
  );
  const transactionWorkflowLayer = TransactionWorkflowService.layer.pipe(
    Layer.provide(
      TransactionWorkflowOperationsService.layer.pipe(
        Layer.provide(Layer.mergeAll(apiLayer, trackingLayer, walletLayer))
      )
    )
  );

  return Layer.mergeAll(
    widgetConfigLayer,
    richErrorLayer,
    apiLayer,
    persistenceLayer,
    trackingLayer,
    walletLayer,
    transactionWorkflowLayer
  ).pipe(Layer.fresh);
};

export const appRuntime = Atom.runtime((get) => {
  const registry = get.registry;

  return makeAppLayer(registry.get(widgetConfigAtom), registry);
});
