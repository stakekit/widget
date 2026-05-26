import type { PropsWithChildren } from "react";
import { createContext, useCallback, useContext, useMemo } from "react";
import type { SettingsContextType } from "../settings/types";
import {
  type Properties,
  type TrackEventKey,
  type TrackPageKey,
  trackEventMap,
  trackPageMap,
} from "./types";
import { useTrackingProps } from "./use-tracking-props";

type TrackingContextType = {
  trackEvent: (event: TrackEventKey, properties?: Properties) => void;
  trackPageView: (page: TrackPageKey, properties?: Properties) => void;
};

export const TrackingContext = createContext<TrackingContextType | undefined>(
  undefined
);

export const TrackingContextProvider = ({
  children,
  tracking,
  variantTracking,
}: PropsWithChildren<{
  tracking: SettingsContextType["tracking"];
  variantTracking?: SettingsContextType["tracking"];
}>) => {
  const trackEvent = useCallback<TrackingContextType["trackEvent"]>(
    (event, props) => {
      tracking?.trackEvent?.(trackEventMap[event], ...(props ? [props] : []));
      variantTracking?.trackEvent?.(
        trackEventMap[event],
        ...(props ? [props] : [])
      );
    },
    [tracking, variantTracking]
  );

  const trackPageView = useCallback<TrackingContextType["trackPageView"]>(
    (page, props) => {
      tracking?.trackPageView?.(trackPageMap[page], ...(props ? [props] : []));
      variantTracking?.trackPageView?.(
        trackPageMap[page],
        ...(props ? [props] : [])
      );
    },
    [tracking, variantTracking]
  );

  const value = useMemo(
    () => ({ trackEvent, trackPageView }),
    [trackEvent, trackPageView]
  );

  return (
    <TrackingContext.Provider value={value}>
      {children}
    </TrackingContext.Provider>
  );
};

export const useTracking = () => {
  const context = useContext(TrackingContext);

  if (context === undefined) {
    throw new Error("useTracking must be used within a TrackingContext");
  }

  return context;
};

export const TrackingContextProviderWithProps = ({
  children,
}: PropsWithChildren) => (
  <TrackingContextProvider {...useTrackingProps()}>
    {children}
  </TrackingContextProvider>
);
