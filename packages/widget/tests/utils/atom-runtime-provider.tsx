import type { PropsWithChildren } from "react";
import { SKAtomRegistryProvider } from "../../src/app/composition/providers/atom-runtime";
import type { WidgetConfig } from "../../src/services/config/widget-config";

export const TestAtomRuntimeProvider = ({
  children,
  settings,
}: PropsWithChildren<{ readonly settings: WidgetConfig }>) => (
  <SKAtomRegistryProvider settings={settings}>
    {children}
  </SKAtomRegistryProvider>
);
