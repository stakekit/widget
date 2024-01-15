import { useLocation, useNavigate } from "react-router-dom";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { TransactionType } from "@stakekit/api-hooks";
import { useUnstakeMatch } from "../../../hooks/navigation/use-unstake-match";
import { usePendingActionMatch } from "../../../hooks/navigation/use-pending-action-match";

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

  const unstakeMatch = useUnstakeMatch();
  const pendingActionMatch = usePendingActionMatch();

  return {
    onClick,
    urls,
    unstakeMatch,
    pendingActionMatch,
    onViewTransactionClick,
  };
};
