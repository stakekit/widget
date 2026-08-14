import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { RouteObject } from "react-router";
import {
  type ApplicationRuntimeInit,
  applicationRuntimeInitAtom,
} from "../../src/app/runtime/application-runtime-init";
import {
  widgetConfigAtom,
  widgetConfigFieldAtom,
} from "../../src/app/runtime/widget-config";
import type { SKAppProps } from "../../src/public-api/types";
import { WidgetConfigService } from "../../src/services/config/widget-config";
import type { WidgetConfig } from "../../src/services/config/widget-config-model";

export { widgetConfigAtom, widgetConfigFieldAtom };

export const getTestWidgetConfig = (
  hostConfiguration: SKAppProps,
  options: { readonly isLedgerLive?: boolean } = {}
): WidgetConfig =>
  Effect.runSync(
    WidgetConfigService.use((config) => config.current).pipe(
      Effect.provide(WidgetConfigService.layer(hostConfiguration, options))
    )
  );

const defaultHostConfiguration: SKAppProps = {
  apiKey: "test-api-key",
  variant: "default",
};

const defaultRoutes: ReadonlyArray<RouteObject> = [{ path: "*" }];

export const applicationRuntimeInit = ({
  hostConfiguration = defaultHostConfiguration,
  isLedgerLive = false,
  routes = defaultRoutes,
}: {
  readonly hostConfiguration?: SKAppProps;
  readonly isLedgerLive?: boolean;
  readonly routes?: ReadonlyArray<RouteObject>;
} = {}): ApplicationRuntimeInit => ({
  hostConfiguration,
  isLedgerLive,
  routes,
});

export const applicationRuntimeInitInitialValue = (
  hostConfiguration: SKAppProps = defaultHostConfiguration,
  isLedgerLive = false,
  routes: ReadonlyArray<RouteObject> = defaultRoutes
) =>
  Atom.initialValue(
    applicationRuntimeInitAtom,
    applicationRuntimeInit({ hostConfiguration, isLedgerLive, routes })
  );
