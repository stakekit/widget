import { useAtomSet } from "@effect/atom-react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";
import type { TransactionType } from "../../../../../domain/types/action";
import { isMobile } from "../../../../../shared/lib/general";
import {
  usePendingActionMatch,
  useUnstakeMatch,
} from "../../../../position-details/state";
import { useSKWallet } from "../../../../wallet/state";
import type { PageCta } from "../../../../widget-shell/components";
import { useClassicFlowExecution } from "../../../react/classic-flow-route";
import { useActivityPendingActionMatch } from "../../../react/use-activity-pending-action-match";
import { useActivityReviewMatch } from "../../../react/use-activity-review.match";
import { useActivityUnstakeActionMatch } from "../../../react/use-activity-unstake.match";
import { useViewTransaction } from "../../use-view-transaction";

export const useComplete = () => {
  const location = useLocation();
  const execution = useClassicFlowExecution();
  const finish = useAtomSet(execution.finishAtom);

  const { isLedgerLive } = useSKWallet();

  const urls: {
    type: TransactionType;
    url: string;
  }[] = location.state?.urls ?? [];

  const onViewTransactionClick = useViewTransaction();

  const onClick = () => {
    if (isLedgerLive && !isMobile()) {
      window.location.href = "ledgerlive://earn";

      return;
    }
    finish(undefined);
  };

  const unstakeMatch = useUnstakeMatch();
  const pendingActionMatch = usePendingActionMatch();

  const activityUnstakeMatch = useActivityUnstakeActionMatch();
  const activityPendingMatch = useActivityPendingActionMatch();
  const activityReviewMatch = useActivityReviewMatch();

  const { t } = useTranslation();

  const resolveCta = (): PageCta => ({
    disabled: false,
    isLoading: false,
    label: t("complete.continue", {
      context: isLedgerLive ? "ledger" : undefined,
    }),
    onClick,
    hide: !!activityReviewMatch,
  });

  return {
    urls,
    unstakeMatch: !!(unstakeMatch || activityUnstakeMatch),
    pendingActionMatch: !!(pendingActionMatch || activityPendingMatch),
    onViewTransactionClick,
    cta: resolveCta(),
  };
};
