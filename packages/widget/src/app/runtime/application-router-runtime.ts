import { Context, Effect, Layer } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import {
  selectWidgetBootstrapSnapshot,
  WidgetConfigService,
} from "../../services/config/widget-config";
import { ApplicationRouter } from "../../services/navigation/application-router";
import { decodeInitParams } from "../../services/wallet/init-params";
import { getLocationHref } from "../../shared/lib/location";
import { resolveInitialRoutePath } from "../routes/initial-route";
import { applicationRuntimeInitAtom } from "./application-runtime-init";

export const applicationRouterRuntime = Atom.runtime((get) => {
  const init = get.registry.get(applicationRuntimeInitAtom);
  if (!init) {
    const missingInit: Layer.Layer<ApplicationRouter | WidgetConfigService> =
      Layer.effectContext(
        Effect.die(
          new Error(
            "Application Runtime init was not provided before runtime use"
          )
        )
      );
    return missingInit;
  }

  const configLayer = WidgetConfigService.layer(init.hostConfiguration, {
    isLedgerLive: init.isLedgerLive,
  }).pipe(Layer.orDie);
  const applicationRouterLayer = Layer.unwrap(
    WidgetConfigService.use((config) =>
      Effect.gen(function* () {
        const settings = yield* config.current;
        const { tab } = decodeInitParams({
          externalProviderInitToken:
            selectWidgetBootstrapSnapshot(settings).wallet
              .externalProviderInitToken,
          href: getLocationHref(),
        });
        const initialEntry = resolveInitialRoutePath({
          borrowAvailable: settings.borrowEnabled,
          tab,
          variant: settings.dashboardVariant ? "dashboard" : "classic",
        });

        return ApplicationRouter.layer(init.routes, {
          initialEntries: [initialEntry],
        });
      }).pipe(Effect.orDie)
    )
  );

  return applicationRouterLayer.pipe(
    Layer.provideMerge(configLayer),
    Layer.fresh
  );
}).pipe(Atom.keepAlive);

export const applicationRouterContextResultAtom = applicationRouterRuntime
  .atom(Effect.context<ApplicationRouter | WidgetConfigService>())
  .pipe(Atom.withLabel("applicationRouterContextResultAtom"));

const applicationRouterContextAtom = Atom.make((get) =>
  AsyncResult.getOrThrow(get(applicationRouterContextResultAtom))
).pipe(Atom.withLabel("applicationRouterContextAtom"));

export const applicationRouterAtom = Atom.make(
  (get) =>
    Context.get(get(applicationRouterContextAtom), ApplicationRouter).router
).pipe(Atom.withLabel("applicationRouterAtom"));
