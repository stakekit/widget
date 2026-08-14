import { Effect, Layer } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { BorrowOperations } from "../../services/api/borrow-operations";
import { BorrowResourceSource } from "../../services/api/borrow-resource-source";
import { GeoBlockService } from "../../services/api/geo-block-state";
import { LegacyResourceSource } from "../../services/api/legacy-resource-source";
import { ApiTransportService } from "../../services/api/transport";
import { YieldOperations } from "../../services/api/yield-operations";
import { YieldResourceSource } from "../../services/api/yield-resource-source";
import { RichErrorService } from "../../services/errors/rich-error-service";
import { WidgetDomainEvents } from "../../services/events/widget-domain-events";
import { WidgetNavigation } from "../../services/navigation/widget-navigation";
import { WidgetPersistence } from "../../services/persistence/widget-persistence";
import { TrackingService } from "../../services/tracking/tracking-service";
import { WidgetTranslation } from "../../services/translation/widget-translation";
import { WalletModal } from "../../services/wallet/wallet-modal";
import { applicationRouterContextResultAtom } from "./application-router-runtime";
import { widgetConfigAtom } from "./widget-config";

const makeAppLayer = (get: Atom.AtomContext) => {
  const baseLayer = Layer.unwrap(
    get
      .result(applicationRouterContextResultAtom)
      .pipe(Effect.orDie)
      .pipe(Effect.map((services) => Layer.succeedContext(services)))
  );
  const richErrorLayer = RichErrorService.layer.pipe(Layer.provide(baseLayer));
  const geoBlockLayer = GeoBlockService.layer;
  const apiTransportLayer = ApiTransportService.layer.pipe(
    Layer.provide(geoBlockLayer),
    Layer.provide(richErrorLayer),
    Layer.provide(baseLayer)
  );
  const apiLayer = Layer.mergeAll(
    BorrowOperations.layer,
    BorrowResourceSource.layer,
    LegacyResourceSource.layer,
    YieldOperations.layer,
    YieldResourceSource.layer
  ).pipe(Layer.provide(apiTransportLayer), Layer.provide(baseLayer));
  const persistenceLayer = WidgetPersistence.layer;
  const trackingLayer = TrackingService.layer.pipe(Layer.provide(baseLayer));
  const widgetTranslationLayer = WidgetTranslation.layer.pipe(
    Layer.provide(baseLayer)
  );
  const navigationLayer = WidgetNavigation.layer(
    () => !get.registry.get(widgetConfigAtom).disableAutoScrollToTop
  ).pipe(Layer.provide(baseLayer));
  return Layer.mergeAll(
    baseLayer,
    geoBlockLayer,
    richErrorLayer,
    apiLayer,
    widgetTranslationLayer,
    persistenceLayer,
    trackingLayer,
    navigationLayer,
    WidgetDomainEvents.layer,
    WalletModal.layer
  ).pipe(Layer.fresh);
};

export const appRuntime = Atom.runtime((get) => makeAppLayer(get));
