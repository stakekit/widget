import { useTracking } from "../../providers/tracking";

export const useTrackEvent = () => useTracking().trackEvent;
