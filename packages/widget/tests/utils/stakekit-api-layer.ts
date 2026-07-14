import { Layer } from "effect";
import { StakeKitApiService } from "../../src/providers/api/api-service";
import {
  defaultWidgetBootstrapConfig,
  type WidgetApiConfig,
  WidgetBootstrapConfig,
} from "../../src/providers/effect-atom-runtime/bootstrap-config";
import { RichErrorService } from "../../src/providers/rich-error/service";

const makeTestLayers = (api: WidgetApiConfig) => {
  const bootstrapLayer = WidgetBootstrapConfig.layer({
    ...defaultWidgetBootstrapConfig,
    api,
  });
  const richErrorLayer = RichErrorService.layer.pipe(
    Layer.provide(bootstrapLayer)
  );
  const apiLayer = StakeKitApiService.layer.pipe(
    Layer.provide(richErrorLayer),
    Layer.provide(bootstrapLayer)
  );

  return { apiLayer, richErrorLayer } as const;
};

export const makeTestStakeKitApiLayer = (api: WidgetApiConfig) => {
  const { apiLayer, richErrorLayer } = makeTestLayers(api);

  return Layer.merge(apiLayer, richErrorLayer).pipe(Layer.fresh);
};
