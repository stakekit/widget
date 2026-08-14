import { useAtomSet } from "@effect/atom-react";
import { type PropsWithChildren, useLayoutEffect } from "react";
import type { SKAppProps } from "../../../public-api/types";
import { updateWidgetConfigAtom } from "../../runtime/widget-config";

export const WidgetConfigBoundaryAdapter = ({
  children,
  hostConfiguration,
}: PropsWithChildren<{ readonly hostConfiguration: SKAppProps }>) => {
  const updateWidgetConfig = useAtomSet(updateWidgetConfigAtom);

  useLayoutEffect(() => {
    updateWidgetConfig(hostConfiguration);
  }, [hostConfiguration, updateWidgetConfig]);

  return children;
};
