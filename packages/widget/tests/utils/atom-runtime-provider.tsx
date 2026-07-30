import { RegistryProvider } from "@effect/atom-react";
import type { ComponentProps, PropsWithChildren } from "react";
import { WidgetConfigBoundaryAdapter } from "../../src/app/composition/providers/widget-config-binding";
import { widgetConfigAtom } from "../../src/app/config/settings";
import { applicationRoutes } from "../../src/app/routes/application-routes";
import { applicationRoutesAtom } from "../../src/app/runtime/application-router-runtime";
import type { WidgetConfig } from "../../src/services/config/widget-config";
import { config } from "../../src/shared/config/widget-defaults";

export const TestAtomRuntimeProvider = ({
  children,
  initialValues,
  settings,
}: PropsWithChildren<{
  readonly initialValues?: ComponentProps<
    typeof RegistryProvider
  >["initialValues"];
  readonly settings: WidgetConfig;
}>) => (
  <RegistryProvider
    defaultIdleTTL={config.atomResources.defaultIdleTTL}
    initialValues={[
      ...(initialValues ?? []),
      [widgetConfigAtom, settings],
      [applicationRoutesAtom, applicationRoutes],
    ]}
  >
    <WidgetConfigBoundaryAdapter settings={settings}>
      {children}
    </WidgetConfigBoundaryAdapter>
  </RegistryProvider>
);
