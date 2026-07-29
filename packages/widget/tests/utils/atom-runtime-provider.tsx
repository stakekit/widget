import type { RegistryProvider } from "@effect/atom-react";
import type { ComponentProps, PropsWithChildren } from "react";
import { SKAtomRegistryProvider } from "../../src/app/composition/providers/atom-runtime";
import { applicationRoutes } from "../../src/app/routes/application-routes";
import type { WidgetConfig } from "../../src/services/config/widget-config";

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
  <SKAtomRegistryProvider
    initialValues={initialValues}
    routes={applicationRoutes}
    settings={settings}
  >
    {children}
  </SKAtomRegistryProvider>
);
