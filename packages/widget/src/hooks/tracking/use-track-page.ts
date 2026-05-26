import { useEffect } from "react";
import { useTracking } from "../../providers/tracking";
import type { Properties, TrackPageKey } from "../../providers/tracking/types";
import { useSavedRef } from "../use-saved-ref";

export const useTrackPage = (
  pageName: TrackPageKey,
  properties?: Properties
) => {
  const { trackPageView } = useTracking();

  const propertiesRef = useSavedRef(properties);

  useEffect(() => {
    if (propertiesRef.current) {
      trackPageView(pageName, propertiesRef.current);
    } else {
      trackPageView(pageName);
    }
  }, [pageName, propertiesRef, trackPageView]);
};
