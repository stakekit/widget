import { Layer } from "effect";
import { apiLayer } from "../../src/services/api/runtime";
import {
  type ApplicationApiIdentity,
  WidgetConfigService,
} from "../../src/services/config/widget-config";
import { RichErrorService } from "../../src/services/errors/rich-error-service";
import { GeoBlockService } from "../../src/services/geoblocking";

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
  const applicationApiLayer = apiLayer.pipe(
    Layer.provide(geoBlockLayer),
    Layer.provide(richErrorLayer),
    Layer.provide(configLayer)
  );

  return {
    apiLayer: applicationApiLayer,
    geoBlockLayer,
    richErrorLayer,
  } as const;
};

export const makeTestStakeKitApiLayer = (api: ApplicationApiIdentity) => {
  const { apiLayer, geoBlockLayer, richErrorLayer } = makeTestLayers(api);

  return Layer.mergeAll(apiLayer, geoBlockLayer, richErrorLayer).pipe(
    Layer.fresh
  );
};
