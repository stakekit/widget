import { useLocation, useMatch, useNavigate } from "react-router-dom";
import { useTrackEvent } from "../../hooks/tracking/use-track-event";

export const useComplete = () => {
  const navigate = useNavigate();

  const location = useLocation();

  const urls: string[] | undefined = location.state?.urls;

  const trackEvent = useTrackEvent();

  const onClick = () => {
    navigate("/");
  };

  const onViewTransactionClick = () => {
    if (!urls) return;

    if (typeof window === "undefined") return;

    trackEvent("viewTxClicked");

    urls.forEach((url) => window.open(url, "_blank"));
  };

  const unstakeMatch = useMatch(
    "unstake/:integrationId/:defaultOrValidatorId/complete"
  );
  const pendingActionMatch = useMatch(
    "pending-action/:integrationId/:defaultOrValidatorId/complete"
  );

  return {
    onClick,
    onViewTransactionClick,
    unstakeMatch,
    pendingActionMatch,
    hasUrs: !!urls?.length,
  };
};
