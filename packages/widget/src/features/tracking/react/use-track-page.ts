import { useAtomSet } from "@effect/atom-react";
import { useEffect, useEffectEvent } from "react";
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

  const reportPageView = useEffectEvent((page: TrackPageKey) =>
    trackPageView({ page, properties })
  );

  useEffect(() => {
    reportPageView(pageName);
  }, [pageName]);
};
