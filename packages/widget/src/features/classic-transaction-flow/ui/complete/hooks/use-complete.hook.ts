import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useTranslation } from "react-i18next";
import { isMobile } from "../../../../../shared/lib/general";
import { useSKWallet } from "../../../../wallet/index";
import type { PageCta } from "../../../../widget-shell/views";
import { getClassicTransactionCompletionUrls } from "../../../model/classic-transaction-workflow";
import {
  useClassicFlowExecution,
  useClassicFlowSession,
} from "../../../react/classic-flow-route";
import { useViewTransaction } from "../../use-view-transaction";

export const useComplete = () => {
  const execution = useClassicFlowExecution();
  const session = useClassicFlowSession();
  const finish = useAtomSet(execution.finishAtom);
  const workflowView = useAtomValue(execution.workflow.viewAtom);

  const isLedgerLive = useSKWallet()?.isLedgerLive ?? false;

  const urls = workflowView.state
    ? getClassicTransactionCompletionUrls(workflowView.state.context)
    : [];

  const onViewTransactionClick = useViewTransaction();

  const onClick = () => {
    if (isLedgerLive && !isMobile()) {
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
        ? t("complete.continue", {
            context: isLedgerLive ? "ledger" : undefined,
          })
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
