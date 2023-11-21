import { useLocation, useMatch, useNavigate } from "react-router-dom";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { TransactionType } from "@stakekit/api-hooks";

export const useComplete = () => {
  const navigate = useNavigate();

  const location = useLocation();

  const urls: {
    type: TransactionType;
    url: string;
  }[] = location.state?.urls ?? [];

  const trackEvent = useTrackEvent();

  const onClick = () => {
    navigate("/");
  };

  const onViewTransactionClick = (url: string) => {
    if (typeof window === "undefined") return;

    trackEvent("viewTxClicked");

    window.open(url, "_blank");
  };

  const unstakeMatch = useMatch(
    "unstake/:integrationId/:defaultOrValidatorId/complete"
  );
  const pendingActionMatch = useMatch(
    "pending-action/:integrationId/:defaultOrValidatorId/complete"
  );

  return {
    onClick,
    urls,
    unstakeMatch,
    pendingActionMatch,
    onViewTransactionClick,
  };
};
