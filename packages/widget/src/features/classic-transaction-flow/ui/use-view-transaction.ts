import { useTrackEvent } from "../../tracking/state";

export const useViewTransaction = () => {
  const trackEvent = useTrackEvent();

  return (url: string) => {
    trackEvent("viewTxClicked");
    window.open(url, "_blank");
  };
};
