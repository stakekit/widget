import { useTracking } from "../../providers/tracking";

export const useTrackEvent = () => {
  const { trackEvent } = useTracking();

  return trackEvent;
};
