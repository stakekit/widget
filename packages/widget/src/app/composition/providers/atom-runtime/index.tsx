import { RegistryProvider, useAtomSet } from "@effect/atom-react";
import { type PropsWithChildren, useLayoutEffect } from "react";
import type { WidgetConfig } from "../../../../services/config/widget-config";
import { config } from "../../../../shared/config/widget-defaults";
import { makeWidgetRuntimeGenerationKey } from "../../../config/runtime-generation";
import { widgetConfigAtom } from "../../../config/settings";

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
