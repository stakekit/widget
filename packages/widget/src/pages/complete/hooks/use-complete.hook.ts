import { useActivityPendingActionMatch } from "@sk-widget/hooks/navigation/use-activity-pending-action-match";
import { useActivityReviewMatch } from "@sk-widget/hooks/navigation/use-activity-review.match";
import { useActivityUnstakeActionMatch } from "@sk-widget/hooks/navigation/use-activity-unstake.match";
import { useSavedRef } from "@sk-widget/hooks/use-saved-ref";
import type { TransactionType } from "@stakekit/api-hooks";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import { usePendingActionMatch } from "../../../hooks/navigation/use-pending-action-match";
import { useUnstakeMatch } from "../../../hooks/navigation/use-unstake-match";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { MaybeWindow } from "../../../utils/maybe-window";
import { useRegisterFooterButton } from "../../components/footer-outlet/context";

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
        label: t("shared.ok"),
        onClick: () => onClickRef.current(),
        hide: !!activityReviewMatch,
      }),
      [onClickRef, t, activityReviewMatch]
    )
  );

  return {
    urls,
    unstakeMatch: !!(unstakeMatch || activityUnstakeMatch),
    pendingActionMatch: !!(pendingActionMatch || activityPendingMatch),
    onViewTransactionClick,
  };
};
