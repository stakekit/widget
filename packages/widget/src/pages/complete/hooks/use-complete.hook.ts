import type { TransactionType } from "@stakekit/api-hooks";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import { useActivityPendingActionMatch } from "../../../hooks/navigation/use-activity-pending-action-match";
import { useActivityReviewMatch } from "../../../hooks/navigation/use-activity-review.match";
import { useActivityUnstakeActionMatch } from "../../../hooks/navigation/use-activity-unstake.match";
import { usePendingActionMatch } from "../../../hooks/navigation/use-pending-action-match";
import { useUnstakeMatch } from "../../../hooks/navigation/use-unstake-match";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { useSavedRef } from "../../../hooks/use-saved-ref";
import { useSKWallet } from "../../../providers/sk-wallet";
import { isMobile } from "../../../utils";
import { MaybeWindow } from "../../../utils/maybe-window";
import { useRegisterFooterButton } from "../../components/footer-outlet/context";

export const useComplete = () => {
  const navigate = useNavigate();

  const location = useLocation();

  const { isLedgerLive } = useSKWallet();

  const urls: {
    type: TransactionType;
    url: string;
  }[] = location.state?.urls ?? [];

  const trackEvent = useTrackEvent();

  const onClick = () => {
    if (isLedgerLive && !isMobile()) {
      window.location.href = "ledgerlive://earn";

      return;
    }
    navigate("/");
  };

  const onViewTransactionClick = (url: string) =>
    MaybeWindow.ifJust((w) => {
      trackEvent("viewTxClicked");

      w.open(url, "_blank");
    });

  const unstakeMatch = useUnstakeMatch();
  const pendingActionMatch = usePendingActionMatch();

  const activityUnstakeMatch = useActivityUnstakeActionMatch();
  const activityPendingMatch = useActivityPendingActionMatch();
  const activityReviewMatch = useActivityReviewMatch();

  const onClickRef = useSavedRef(onClick);

  const { t } = useTranslation();

  useRegisterFooterButton(
    useMemo(
      () => ({
        disabled: false,
        isLoading: false,
        label: t("complete.continue", {
          context: isLedgerLive ? "ledger" : undefined,
        }),
        onClick: () => onClickRef.current(),
        hide: !!activityReviewMatch,
      }),
      [onClickRef, t, activityReviewMatch, isLedgerLive]
    )
  );

  return {
    urls,
    unstakeMatch: !!(unstakeMatch || activityUnstakeMatch),
    pendingActionMatch: !!(pendingActionMatch || activityPendingMatch),
    onViewTransactionClick,
  };
};
