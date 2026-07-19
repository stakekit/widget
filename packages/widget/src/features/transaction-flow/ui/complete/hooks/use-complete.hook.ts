import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import type { TransactionType } from "../../../../../domain/types/action";
import { isMobile } from "../../../../../shared/lib/general";
import { useActivityPendingActionMatch } from "../../../../../shared/react/navigation/use-activity-pending-action-match";
import { useActivityReviewMatch } from "../../../../../shared/react/navigation/use-activity-review.match";
import { useActivityUnstakeActionMatch } from "../../../../../shared/react/navigation/use-activity-unstake.match";
import { usePendingActionMatch } from "../../../../../shared/react/navigation/use-pending-action-match";
import { useUnstakeMatch } from "../../../../../shared/react/navigation/use-unstake-match";
import { useSavedRef } from "../../../../../shared/react/use-saved-ref";
import { useTrackEvent } from "../../../../tracking/react/use-track-event";
import { useSKWallet } from "../../../../wallet/react/use-wallet";
import type { PageCta } from "../../../../widget-shell/page-cta";

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

  const onViewTransactionClick = (url: string) => {
    trackEvent("viewTxClicked");
    window.open(url, "_blank");
  };

  const unstakeMatch = useUnstakeMatch();
  const pendingActionMatch = usePendingActionMatch();

  const activityUnstakeMatch = useActivityUnstakeActionMatch();
  const activityPendingMatch = useActivityPendingActionMatch();
  const activityReviewMatch = useActivityReviewMatch();

  const onClickRef = useSavedRef(onClick);

  const { t } = useTranslation();

  const cta = useMemo<PageCta>(
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
  );

  return {
    urls,
    unstakeMatch: !!(unstakeMatch || activityUnstakeMatch),
    pendingActionMatch: !!(pendingActionMatch || activityPendingMatch),
    onViewTransactionClick,
    cta,
  };
};
