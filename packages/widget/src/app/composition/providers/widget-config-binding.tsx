import { useAtomSet } from "@effect/atom-react";
import { type PropsWithChildren, useLayoutEffect } from "react";

import type { SKHostConfiguration } from "../../../public-api/react-types";
import { updateWidgetConfigAtom } from "../../../runtime/widget-config";

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
