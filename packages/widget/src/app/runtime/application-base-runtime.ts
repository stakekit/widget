import { Effect, Layer } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import {
  selectWidgetBootstrapSnapshot,
  WidgetConfigService,
} from "../../services/config/widget-config";
import { ApplicationRouter } from "../../services/navigation/application-router";
import { decodeInitParams } from "../../services/wallet/init-params";
import type { WalletConnectorSource } from "../../services/wallet/wallet-connector-source";
import { getLocationHref } from "../../shared/lib/location";
import { resolveInitialRoutePath } from "../routes/initial-route";
import { applicationRuntimeInitAtom } from "./application-runtime-init";
import { walletConnectorSourceRuntime } from "./wallet-connector-source-runtime";

type ApplicationBaseServices =
  | ApplicationRouter
  | WalletConnectorSource
  | WidgetConfigService;

export const applicationBaseRuntime = Atom.runtime<
  ApplicationBaseServices,
  never
>((get) => {
  const init = get(applicationRuntimeInitAtom);
  if (!init) {
    const missingInit: Layer.Layer<ApplicationBaseServices> =
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
  const runtimeLayer: Layer.Layer<ApplicationBaseServices> = Layer.merge(
    applicationRouterLayer.pipe(Layer.provideMerge(configLayer)),
    get(walletConnectorSourceRuntime.layer)
  );

  return runtimeLayer;
}).pipe(Atom.keepAlive);
