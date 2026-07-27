import { RegistryProvider } from "@effect/atom-react";
import type { PropsWithChildren } from "react";
import type { RouteObject } from "react-router";
import type { WidgetConfig } from "../../../../services/config/widget-config";
import { config } from "../../../../shared/config/widget-defaults";
import { makeWidgetRuntimeGenerationKey } from "../../../config/runtime-generation";
import { widgetConfigAtom } from "../../../config/settings";
import { applicationRoutesAtom } from "../../../runtime/application-router-runtime";
import { WidgetConfigBoundaryAdapter } from "../widget-config-binding";

export const SKAtomRegistryProvider = ({
  children,
  routes,
  settings,
}: PropsWithChildren<{
  readonly routes: ReadonlyArray<RouteObject>;
  readonly settings: WidgetConfig;
}>) => {
  return (
    <RegistryProvider
      key={makeWidgetRuntimeGenerationKey(settings)}
      defaultIdleTTL={config.atomResources.defaultIdleTTL}
      initialValues={[
        [widgetConfigAtom, settings],
        [applicationRoutesAtom, routes],
      ]}
    >
      <WidgetConfigBoundaryAdapter settings={settings}>
        {children}
      </WidgetConfigBoundaryAdapter>
    </RegistryProvider>
  );
};
