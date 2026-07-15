import { useAtomSet } from "@effect/atom-react";
import { useEffect, useLayoutEffect, useRef } from "react";
import type {
  Properties,
  TrackPageKey,
} from "../../../services/tracking/types";
import { trackPageViewAtom } from "../state/commands";

export const useTrackPage = (
  pageName: TrackPageKey,
  properties?: Properties
) => {
  const trackPageView = useAtomSet(trackPageViewAtom);
  const propertiesRef = useRef(properties);

  useLayoutEffect(() => {
    propertiesRef.current = properties;
  });

  useEffect(() => {
    trackPageView({ page: pageName, properties: propertiesRef.current });
  }, [pageName, trackPageView]);
};
