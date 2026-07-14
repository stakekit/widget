import { Layer } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { StepsMachineService } from "../../pages/steps/state/steps-machine-runtime";
import { StakeKitApiService } from "../api/api-service";
import { RichErrorService } from "../rich-error/service";
import { TrackingService } from "../tracking/service";
import { WalletService } from "../wallet/runtime/service";
import {
  WidgetBootstrapConfig,
  type WidgetBootstrapConfigValue,
  widgetBootstrapConfigAtom,
} from "./bootstrap-config";
import { WidgetPersistence } from "./persistence";

/**
 * Shared composition points for widget-owned Effect services.
 *
 * Focused runtimes prevent an unavailable service from failing unrelated
 * state. Wallet execution, API operations, and tracking runtimes join
 * this module as their migrations replace React/Promise adapters.
 */
const richErrorLayer = RichErrorService.layer;
const applicationApiLayer = StakeKitApiService.layer.pipe(
  Layer.provide(richErrorLayer)
);
const widgetPersistenceLayer = WidgetPersistence.layer;
const walletLayer = WalletService.layer.pipe(
  Layer.provide(widgetPersistenceLayer)
);
const stepsMachineLayer = StepsMachineService.layer.pipe(
  Layer.provide(
    Layer.mergeAll(applicationApiLayer, TrackingService.layer, walletLayer)
  )
);

const widgetServicesLayer = Layer.mergeAll(
  applicationApiLayer,
  richErrorLayer,
  widgetPersistenceLayer,
  TrackingService.layer,
  walletLayer,
  stepsMachineLayer
);

const makeWidgetServicesLayer = (config: WidgetBootstrapConfigValue) =>
  widgetServicesLayer.pipe(
    Layer.provide(WidgetBootstrapConfig.layer(config)),
    Layer.fresh
  );

const widgetServicesLayers = new WeakMap<
  WidgetBootstrapConfigValue,
  ReturnType<typeof makeWidgetServicesLayer>
>();

export const getWidgetServicesLayer = (config: WidgetBootstrapConfigValue) => {
  const existing = widgetServicesLayers.get(config);
  if (existing) return existing;

  const layer = makeWidgetServicesLayer(config);
  widgetServicesLayers.set(config, layer);
  return layer;
};

export const widgetAtomRuntime = Atom.runtime((get) =>
  getWidgetServicesLayer(get(widgetBootstrapConfigAtom))
);
