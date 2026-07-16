import type { PropsWithChildren } from "react";
import {
  SKAtomRegistryProvider,
  SKRootInputProvider,
} from "../../src/app/composition/providers/atom-runtime";
import type { WidgetConfig } from "../../src/app/config";

export const TestAtomRuntimeProvider = ({
  children,
  settings,
}: PropsWithChildren<{ readonly settings: WidgetConfig }>) => (
  <SKAtomRegistryProvider settings={settings}>
    <SKRootInputProvider>{children}</SKRootInputProvider>
  </SKAtomRegistryProvider>
);
