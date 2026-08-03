import { Effect, Layer, Stream } from "effect";
import { normalizeWidgetConfig } from "../../src/app/config/settings";
import { BorrowOperations } from "../../src/services/api/borrow-operations";
import { BorrowResourceSource } from "../../src/services/api/borrow-resource-source";
import { GeoBlockService } from "../../src/services/api/geo-block-state";
import { LegacyResourceSource } from "../../src/services/api/legacy-resource-source";
import { ApiTransportService } from "../../src/services/api/transport";
import { YieldOperations } from "../../src/services/api/yield-operations";
import { YieldResourceSource } from "../../src/services/api/yield-resource-source";
import {
  type WidgetApiConfig,
  WidgetConfigService,
} from "../../src/services/config/widget-config";
import { RichErrorService } from "../../src/services/errors/rich-error-service";

const makeTestLayers = (api: WidgetApiConfig) => {
  const config = normalizeWidgetConfig({
    ...api,
    borrowEnabled: true,
    dashboardVariant: true,
    variant: "default",
  });
  const configLayer = WidgetConfigService.layer({
    initial: config,
    changes: Stream.never,
    current: Effect.succeed(config),
  });
  const richErrorLayer = RichErrorService.layer.pipe(
    Layer.provide(configLayer)
  );
  const geoBlockLayer = GeoBlockService.layer;
  const transportLayer = ApiTransportService.layer.pipe(
    Layer.provide(geoBlockLayer),
    Layer.provide(richErrorLayer),
    Layer.provide(configLayer)
  );
  const apiLayer = Layer.mergeAll(
    BorrowOperations.layer,
    BorrowResourceSource.layer,
    LegacyResourceSource.layer,
    YieldOperations.layer,
    YieldResourceSource.layer
  ).pipe(Layer.provide(transportLayer), Layer.provide(configLayer));

  return { apiLayer, geoBlockLayer, richErrorLayer } as const;
};

export const makeTestStakeKitApiLayer = (api: WidgetApiConfig) => {
  const { apiLayer, geoBlockLayer, richErrorLayer } = makeTestLayers(api);

  return Layer.mergeAll(apiLayer, geoBlockLayer, richErrorLayer).pipe(
    Layer.fresh
  );
};
