import { RegistryProvider, useAtomSet } from "@effect/atom-react";
import type { PropsWithChildren } from "react";
import { useLayoutEffect, useState } from "react";
import type { TrackingConfig } from "../../../../public-api/types";
import type { WidgetConfig } from "../../../../services/config/widget-config";
import {
  normalizeWidgetConfig,
  widgetConfigAtom,
} from "../../../config/settings";

type TrackingProviderProps = PropsWithChildren<{
  readonly tracking: TrackingConfig | undefined;
  readonly variantTracking?: TrackingConfig;
}>;

const makeTrackingConfig = ({
  tracking,
  variantTracking,
}: Omit<TrackingProviderProps, "children">): TrackingConfig => ({
  trackEvent: (event, properties) => {
    tracking?.trackEvent?.(event, properties);
    variantTracking?.trackEvent?.(event, properties);
  },
  trackPageView: (page, properties) => {
    tracking?.trackPageView?.(page, properties);
    variantTracking?.trackPageView?.(page, properties);
  },
});

const TrackingConfigBinding = ({
  children,
  settings,
}: PropsWithChildren<{ readonly settings: WidgetConfig }>) => {
  const setWidgetConfig = useAtomSet(widgetConfigAtom);

  useLayoutEffect(() => {
    setWidgetConfig(settings);
  }, [setWidgetConfig, settings]);

  return children;
};

export const TrackingContextProvider = ({
  children,
  tracking,
  variantTracking,
}: TrackingProviderProps) => {
  const settings = normalizeWidgetConfig({
    apiKey: "",
    tracking: makeTrackingConfig({ tracking, variantTracking }),
    variant: "default",
  });
  const [initialSettings] = useState(settings);

  return (
    <RegistryProvider initialValues={[[widgetConfigAtom, initialSettings]]}>
      <TrackingConfigBinding settings={settings}>
        {children}
      </TrackingConfigBinding>
    </RegistryProvider>
  );
};
