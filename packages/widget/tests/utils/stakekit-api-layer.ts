import { Layer } from "effect";
import { BorrowOperations } from "../../src/services/api/borrow-operations";
import { BorrowResourceSource } from "../../src/services/api/borrow-resource-source";
import { GeoBlockService } from "../../src/services/api/geo-block-state";
import { LegacyResourceSource } from "../../src/services/api/legacy-resource-source";
import { ApiTransportService } from "../../src/services/api/transport";
import { YieldOperations } from "../../src/services/api/yield-operations";
import { YieldResourceSource } from "../../src/services/api/yield-resource-source";
import {
  type ApplicationApiIdentity,
  WidgetConfigService,
} from "../../src/services/config/widget-config";
import { RichErrorService } from "../../src/services/errors/rich-error-service";

const makeTestLayers = (api: ApplicationApiIdentity) => {
  const configLayer = WidgetConfigService.layer({
    ...api,
    borrowEnabled: true,
    dashboardVariant: true,
    variant: "default",
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

export const makeTestStakeKitApiLayer = (api: ApplicationApiIdentity) => {
  const { apiLayer, geoBlockLayer, richErrorLayer } = makeTestLayers(api);

  return Layer.mergeAll(apiLayer, geoBlockLayer, richErrorLayer).pipe(
    Layer.fresh
  );
};
