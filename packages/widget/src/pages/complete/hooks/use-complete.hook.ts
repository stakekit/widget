import { useActivityUnstakeActionMatch } from "@sk-widget/hooks/navigation/use-activiti-unstake.match";
import { useActivityPendingActionMatch } from "@sk-widget/hooks/navigation/use-activity-pending-action-match";
import { useActivityReviewMatch } from "@sk-widget/hooks/navigation/use-activity-review.match";
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
  const activityMatch = useActivityReviewMatch();

  const onClickRef = useSavedRef(onClick);

  const { t } = useTranslation();

  useRegisterFooterButton(
    useMemo(
      () => ({
        disabled: false,
        isLoading: false,
        label: t("shared.ok"),
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
