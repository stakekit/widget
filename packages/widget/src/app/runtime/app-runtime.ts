import { Layer } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import {
  BorrowApiService,
  LegacyApiService,
  YieldApiService,
} from "../../services/api";
import { ApiTransportService } from "../../services/api/transport";
import {
  BorrowExecutionEventsService,
  BorrowWalletExecutionService,
} from "../../services/borrow/transaction-execution";
import {
  WidgetBootstrapConfig,
  type WidgetBootstrapConfigValue,
} from "../../services/config/widget-config";
import { RichErrorService } from "../../services/errors/rich-error-service";
import { WidgetPersistence } from "../../services/persistence/widget-persistence";
import { TrackingService } from "../../services/tracking/tracking-service";
import { WalletService } from "../../services/wallet/wallet-service";
import { StepsMachineService } from "../../services/workflow/steps-machine-service";
import { widgetBootstrapConfigAtom } from "../config";

const makeAppLayer = (config: WidgetBootstrapConfigValue) => {
  const configurationLayer = WidgetBootstrapConfig.layer(config);
  const richErrorLayer = RichErrorService.layer;
  const apiTransportLayer = ApiTransportService.layer.pipe(
    Layer.provide(richErrorLayer),
    Layer.provide(configurationLayer)
  );
  const apiLayer = Layer.mergeAll(
    BorrowApiService.layer,
    LegacyApiService.layer,
    YieldApiService.layer
  ).pipe(Layer.provide(apiTransportLayer));
  const persistenceLayer = WidgetPersistence.layer;
  const trackingLayer = TrackingService.layer.pipe(
    Layer.provide(configurationLayer)
  );
  const walletLayer = WalletService.layer.pipe(Layer.provide(persistenceLayer));
  const stepsLayer = StepsMachineService.layer.pipe(
    Layer.provide(Layer.mergeAll(apiLayer, trackingLayer, walletLayer))
  );
  const borrowWalletLayer = BorrowWalletExecutionService.layer.pipe(
    Layer.provide(walletLayer)
  );

  return Layer.mergeAll(
    configurationLayer,
    richErrorLayer,
    apiLayer,
    persistenceLayer,
    trackingLayer,
    walletLayer,
    stepsLayer,
    borrowWalletLayer,
    BorrowExecutionEventsService.layer
  ).pipe(Layer.provide(configurationLayer), Layer.fresh);
};

export const appRuntime = Atom.runtime((get) =>
  makeAppLayer(get(widgetBootstrapConfigAtom))
);
