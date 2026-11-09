import { Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";
import type { RouteObject } from "react-router";

import type { SKAppProps } from "../../src/public-api/react-types";
import {
  type ApplicationRuntimeInit,
  applicationRuntimeInitAtom,
} from "../../src/runtime/application-runtime-init";
import { widgetConfigAtom } from "../../src/runtime/widget-config";
import { WidgetConfigService } from "../../src/services/config/widget-config";
import type { WidgetConfig } from "../../src/services/config/widget-config-model";

export { widgetConfigAtom };

export const getTestWidgetConfig = (
  hostConfiguration: SKAppProps,
  options: { readonly isLedgerLive?: boolean } = {}
): WidgetConfig =>
  // oxlint-disable-next-line effect/no-run-effect-in-test -- synchronous fixture factory for non-Effect UI tests
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

const applicationRuntimeInit = ({
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
