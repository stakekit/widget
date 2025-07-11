import { useActivityUnstakeActionMatch } from "@sk-widget/hooks/navigation/use-activiti-unstake.match";
import { useActivityPendingActionMatch } from "@sk-widget/hooks/navigation/use-activity-pending-action-match";
import { useActivityReviewMatch } from "@sk-widget/hooks/navigation/use-activity-review.match";
import { useSKWallet } from "@sk-widget/providers/sk-wallet";
import { isMobile } from "@sk-widget/utils";
import type { TransactionType } from "@stakekit/api-hooks";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import { useSavedRef } from "../../../hooks";
import { usePendingActionMatch } from "../../../hooks/navigation/use-pending-action-match";
import { useUnstakeMatch } from "../../../hooks/navigation/use-unstake-match";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
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
  const activityMatch = useActivityReviewMatch();

  const onClickRef = useSavedRef(onClick);

  const { t } = useTranslation();

  useRegisterFooterButton(
    useMemo(
      () => ({
        disabled: false,
        isLoading: false,
        label: t("complete.continue"),
        onClick: () => onClickRef.current(),
        hide: !!activityMatch,
      }),
      [onClickRef, t, activityMatch]
    )
  );

  return {
    urls,
    unstakeMatch: unstakeMatch || activityUnstakeMatch,
    pendingActionMatch: pendingActionMatch || activityPendingMatch,
    onViewTransactionClick,
  };
};
