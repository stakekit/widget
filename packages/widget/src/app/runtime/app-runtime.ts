import { Effect, Layer } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { BorrowOperations } from "../../services/api/borrow-operations";
import { BorrowResourceSource } from "../../services/api/borrow-resource-source";
import { LegacyResourceSource } from "../../services/api/legacy-resource-source";
import { ApiTransportService } from "../../services/api/transport";
import { YieldOperations } from "../../services/api/yield-operations";
import { YieldResourceSource } from "../../services/api/yield-resource-source";
import {
  type WidgetConfig,
  WidgetConfigService,
} from "../../services/config/widget-config";
import { RichErrorService } from "../../services/errors/rich-error-service";
import { WidgetPersistence } from "../../services/persistence/widget-persistence";
import { TrackingService } from "../../services/tracking/tracking-service";
import { widgetConfigAtom } from "../config/settings";

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
    BorrowOperations.layer,
    BorrowResourceSource.layer,
    LegacyResourceSource.layer,
    YieldOperations.layer,
    YieldResourceSource.layer
  ).pipe(Layer.provide(apiTransportLayer));
  const persistenceLayer = WidgetPersistence.layer;
  const trackingLayer = TrackingService.layer.pipe(
    Layer.provide(widgetConfigLayer)
  );
  return Layer.mergeAll(
    widgetConfigLayer,
    richErrorLayer,
    apiLayer,
    persistenceLayer,
    trackingLayer
  ).pipe(Layer.fresh);
};

export const appRuntime = Atom.runtime((get) => {
  const registry = get.registry;

  return makeAppLayer(registry.get(widgetConfigAtom), registry);
});
