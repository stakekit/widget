import { RegistryProvider } from "@effect/atom-react";
import type { PropsWithChildren } from "react";
import {
  normalizeWidgetConfig,
  widgetConfigAtom,
} from "../../src/app/config/settings";
import type { SettingsProps, VariantProps } from "../../src/public-api/types";

export const TestWidgetConfigProvider = ({
  children,
  ...props
}: PropsWithChildren<SettingsProps & VariantProps>) => {
  const settings = normalizeWidgetConfig(props);

  return (
    <RegistryProvider initialValues={[[widgetConfigAtom, settings]]}>
      {children}
    </RegistryProvider>
  );
};
