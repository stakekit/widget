import { Effect, Layer, Stream } from "effect";
import { normalizeWidgetConfig } from "../../src/app/config/settings";
import { BorrowApiService } from "../../src/services/api/borrow-api-service";
import { LegacyApiService } from "../../src/services/api/legacy-api-service";
import { ApiTransportService } from "../../src/services/api/transport";
import { YieldApiService } from "../../src/services/api/yield-api-service";
import {
  type WidgetApiConfig,
  WidgetConfigService,
} from "../../src/services/config/widget-config";
import { RichErrorService } from "../../src/services/errors/rich-error-service";

const makeTestLayers = (api: WidgetApiConfig) => {
  const config = normalizeWidgetConfig({ ...api, variant: "default" });
  const configLayer = WidgetConfigService.layer({
    initial: config,
    changes: Stream.never,
    current: Effect.succeed(config),
  });
  const richErrorLayer = RichErrorService.layer.pipe(
    Layer.provide(configLayer)
  );
  const transportLayer = ApiTransportService.layer.pipe(
    Layer.provide(richErrorLayer),
    Layer.provide(configLayer)
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
