import { RegistryProvider, useAtomSet } from "@effect/atom-react";
import { type PropsWithChildren, useLayoutEffect } from "react";
import { config } from "../../../../shared/config/widget-defaults";
import {
  makeWidgetRuntimeGenerationKey,
  type WidgetConfig,
  widgetConfigAtom,
} from "../../../config";

export const SKAtomRegistryProvider = ({
  children,
  settings,
}: PropsWithChildren<{ readonly settings: WidgetConfig }>) => {
  return (
    <RegistryProvider
      key={makeWidgetRuntimeGenerationKey(settings)}
      defaultIdleTTL={config.atomResources.defaultIdleTTL}
      initialValues={[[widgetConfigAtom, settings]]}
    >
      <WidgetConfigBinding settings={settings}>{children}</WidgetConfigBinding>
    </RegistryProvider>
  );
};

const WidgetConfigBinding = ({
  children,
  settings,
}: PropsWithChildren<{ readonly settings: WidgetConfig }>) => {
  const setWidgetConfig = useAtomSet(widgetConfigAtom);

  useLayoutEffect(() => {
    setWidgetConfig(settings);
  }, [setWidgetConfig, settings]);

  return children;
};
