import { RegistryProvider } from "@effect/atom-react";
import type { PropsWithChildren } from "react";
import type { RouteObject } from "react-router";
import type { WidgetConfig } from "../../../../services/config/widget-config";
import { widgetConfigAtom } from "../../../config/settings";
import { applicationRoutesAtom } from "../../../runtime/application-router-runtime";
import { WidgetConfigBoundaryAdapter } from "../widget-config-binding";

type SKAtomRegistryProviderProps = PropsWithChildren<{
  readonly routes: ReadonlyArray<RouteObject>;
  readonly settings: WidgetConfig;
}>;

export const SKAtomRegistryProvider = ({
  children,
  routes,
  settings,
}: SKAtomRegistryProviderProps) => {
  return (
    <RegistryProvider
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
