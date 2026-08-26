import { Layer } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { widgetConfigAtom } from "../../features/widget-configuration/index";
import { apiLayer } from "../../services/api/runtime";
import { RichErrorService } from "../../services/errors/rich-error-service";
import { WidgetDomainEvents } from "../../services/events/widget-domain-events";
import { GeoBlockService } from "../../services/geoblocking";
import { WidgetNavigation } from "../../services/navigation/widget-navigation";
import { WidgetPersistence } from "../../services/persistence/widget-persistence";
import { TrackingService } from "../../services/tracking/tracking-service";
import { WidgetTranslation } from "../../services/translation/widget-translation";
import { WalletModal } from "../../services/wallet/wallet-modal";
import { applicationBaseRuntime } from "./application-base-runtime";

const makeAppLayer = (get: Atom.AtomContext) => {
  const baseLayer = get(applicationBaseRuntime.layer);
  const richErrorLayer = RichErrorService.layer.pipe(Layer.provide(baseLayer));
  const geoBlockLayer = GeoBlockService.layer;
  const applicationApiLayer = apiLayer.pipe(
    Layer.provide(geoBlockLayer),
    Layer.provide(richErrorLayer),
    Layer.provide(baseLayer)
  );
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
    applicationApiLayer,
    widgetTranslationLayer,
    persistenceLayer,
    trackingLayer,
    navigationLayer,
    WidgetDomainEvents.layer,
    WalletModal.layer
  );
};

export const appRuntime = Atom.runtime((get) => makeAppLayer(get));
