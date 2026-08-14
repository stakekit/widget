import { RegistryProvider } from "@effect/atom-react";
import type { PropsWithChildren } from "react";
import type { TrackingConfig } from "../../../../public-api/types";
import { applicationRuntimeInitAtom } from "../../../runtime/application-runtime-init";
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
  const hostConfiguration = {
    apiKey: "",
    tracking: makeTrackingConfig({ tracking, variantTracking }),
  } as const;

  return (
    <RegistryProvider
      initialValues={[
        [
          applicationRuntimeInitAtom,
          {
            hostConfiguration,
            isLedgerLive: false,
            routes: [{ path: "*" }],
          },
        ],
      ]}
    >
      <WidgetConfigBoundaryAdapter hostConfiguration={hostConfiguration}>
        {children}
      </WidgetConfigBoundaryAdapter>
    </RegistryProvider>
  );
};
