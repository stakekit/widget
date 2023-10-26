import { useEffect } from "react";
import { useSavedRef } from "../use-saved-ref";
import {
  Properties,
  TrackPageKey,
  useTracking,
} from "../../providers/tracking";

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
