import { Layer } from "effect";
import {
  BorrowApiService,
  LegacyApiService,
  YieldApiService,
} from "../../src/services/api";
import { ApiTransportService } from "../../src/services/api/transport";
import {
  defaultWidgetBootstrapConfig,
  type WidgetApiConfig,
  WidgetBootstrapConfig,
} from "../../src/services/config/widget-config";
import { RichErrorService } from "../../src/services/errors/rich-error-service";

const makeTestLayers = (api: WidgetApiConfig) => {
  const bootstrapLayer = WidgetBootstrapConfig.layer({
    ...defaultWidgetBootstrapConfig,
    api,
  });
  const richErrorLayer = RichErrorService.layer.pipe(
    Layer.provide(bootstrapLayer)
  );
  const transportLayer = ApiTransportService.layer.pipe(
    Layer.provide(richErrorLayer),
    Layer.provide(bootstrapLayer)
  );
  const apiLayer = Layer.mergeAll(
    BorrowApiService.layer,
    LegacyApiService.layer,
    YieldApiService.layer
  ).pipe(Layer.provide(transportLayer));

  return { apiLayer, richErrorLayer } as const;
};

export const makeTestStakeKitApiLayer = (api: WidgetApiConfig) => {
  const { apiLayer, richErrorLayer } = makeTestLayers(api);

  return Layer.merge(apiLayer, richErrorLayer).pipe(Layer.fresh);
};
