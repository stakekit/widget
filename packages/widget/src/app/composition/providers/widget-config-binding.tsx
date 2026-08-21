import { useAtomSet } from "@effect/atom-react";
import { type PropsWithChildren, useLayoutEffect } from "react";
import { updateWidgetConfigAtom } from "../../../features/widget-configuration/index";
import type { SKHostConfiguration } from "../../../public-api/types";

export const WidgetConfigBoundaryAdapter = ({
  children,
  hostConfiguration,
}: PropsWithChildren<{ readonly hostConfiguration: SKHostConfiguration }>) => {
  const updateWidgetConfig = useAtomSet(updateWidgetConfigAtom);

  useLayoutEffect(() => {
    updateWidgetConfig(hostConfiguration);
  }, [hostConfiguration, updateWidgetConfig]);

  return children;
};
