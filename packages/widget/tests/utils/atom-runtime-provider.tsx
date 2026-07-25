import type { PropsWithChildren } from "react";
import { SKAtomRegistryProvider } from "../../src/app/composition/providers/atom-runtime";
import { applicationRoutes } from "../../src/app/routes/application-routes";
import type { WidgetConfig } from "../../src/services/config/widget-config";

export const TestAtomRuntimeProvider = ({
  children,
  settings,
}: PropsWithChildren<{
  readonly settings: WidgetConfig;
}>) => (
  <SKAtomRegistryProvider routes={applicationRoutes} settings={settings}>
    {children}
  </SKAtomRegistryProvider>
);
