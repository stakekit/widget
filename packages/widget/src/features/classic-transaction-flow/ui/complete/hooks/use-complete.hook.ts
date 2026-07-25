import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";
import type { TransactionType } from "../../../../../domain/types/action";
import { isMobile } from "../../../../../shared/lib/general";
import { useSavedRef } from "../../../../../shared/react/use-saved-ref";
import {
  usePendingActionMatch,
  useUnstakeMatch,
} from "../../../../position-details/state";
import { useTrackEvent } from "../../../../tracking/state";
import { useSKWallet } from "../../../../wallet/state";
import type { PageCta } from "../../../../widget-shell/components";
import { useActivityPendingActionMatch } from "../../../react/use-activity-pending-action-match";
import { useActivityReviewMatch } from "../../../react/use-activity-review.match";
import { useActivityUnstakeActionMatch } from "../../../react/use-activity-unstake.match";
import {
  classicFlowSessionStore,
  finishClassicTransactionFlowAtom,
} from "../../../state/flow-session-store";

export const useComplete = () => {
  const location = useLocation();
  const session = useAtomValue(classicFlowSessionStore.currentSessionAtom);
  const finish = useAtomSet(finishClassicTransactionFlowAtom);

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
    if (session) {
      finish(session.epoch);
    }
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
