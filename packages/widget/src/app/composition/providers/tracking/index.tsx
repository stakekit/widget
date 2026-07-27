import { RegistryProvider } from "@effect/atom-react";
import type { PropsWithChildren } from "react";
import { useState } from "react";
import type { TrackingConfig } from "../../../../public-api/types";
import {
  normalizeWidgetConfig,
  widgetConfigAtom,
} from "../../../config/settings";
import { WidgetConfigBoundaryAdapter } from "../widget-config-binding";

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
      <WidgetConfigBoundaryAdapter settings={settings}>
        {children}
      </WidgetConfigBoundaryAdapter>
    </RegistryProvider>
  );
};
