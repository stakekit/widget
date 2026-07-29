import { useAtom } from "@effect/atom-react";
import { Equal } from "effect";
import { type PropsWithChildren, useLayoutEffect } from "react";
import type { WidgetConfig } from "../../../services/config/widget-config";
import { assertApplicationRuntimeIdentity } from "../../config/application-runtime-identity";
import { widgetConfigAtom } from "../../config/settings";

export const WidgetConfigBoundaryAdapter = ({
  children,
  settings,
}: PropsWithChildren<{ readonly settings: WidgetConfig }>) => {
  const [currentSettings, setWidgetConfig] = useAtom(widgetConfigAtom);

  assertApplicationRuntimeIdentity(currentSettings, settings);

  useLayoutEffect(() => {
    if (Equal.equals(currentSettings, settings)) return;
    setWidgetConfig(settings);
  }, [currentSettings, setWidgetConfig, settings]);

  return children;
};
