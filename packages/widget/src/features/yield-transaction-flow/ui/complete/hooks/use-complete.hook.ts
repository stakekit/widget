import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useTranslation } from "react-i18next";
import { isMobile } from "../../../../../shared/lib/general";
import { useSKWallet } from "../../../../wallet/index";
import type { PageCta } from "../../../../widget-shell/views";
import { getYieldTransactionCompletionUrls } from "../../../model/yield-transaction-workflow";
import {
  useYieldFlowExecution,
  useYieldFlowSession,
} from "../../../react/yield-flow-route";
import { useViewTransaction } from "../../use-view-transaction";

export const useComplete = () => {
  const execution = useYieldFlowExecution();
  const session = useYieldFlowSession();
  const finish = useAtomSet(execution.finishAtom);
  const workflowView = useAtomValue(execution.workflow.viewAtom);

  // Ledger Live desktop leaves for its Earn dashboard; elsewhere the flow finishes in the widget.
  const opensLedgerEarn = (useSKWallet()?.isLedgerLive ?? false) && !isMobile();

  const urls = workflowView.state
    ? getYieldTransactionCompletionUrls(workflowView.state.context)
    : [];

  const onViewTransactionClick = useViewTransaction();

  const onClick = () => {
    if (opensLedgerEarn) {
      window.location.assign("ledgerlive://earn");

      return;
    }
    finish(undefined);
  };

  const activityAction =
    session.intake._tag === "YieldActionContinuation"
      ? session.intake.action
      : null;
  const unstake =
    session.mount._tag === "PositionExit" || activityAction?.intent === "exit";
  const pendingAction =
    session.mount._tag === "PositionManage" ||
    activityAction?.intent === "manage";

  const { t } = useTranslation();

  const resolveCta = (): PageCta => ({
    disabled: false,
    isLoading: false,
    label:
      activityAction === null
        ? t("complete.continue", opensLedgerEarn ? { context: "ledger" } : {})
        : t("activity.complete.continue"),
    onClick,
    hide: false,
  });

  return {
    urls,
    unstakeMatch: unstake,
    pendingActionMatch: pendingAction,
    onViewTransactionClick,
    cta: resolveCta(),
  };
};
