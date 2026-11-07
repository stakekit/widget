import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useTranslation } from "react-i18next";
import { isMobile } from "../../../../../shared/lib/general";
import { useTrackEvent } from "../../../../tracking/index";
import { useSKWallet } from "../../../../wallet/index";
import type { PageCta } from "../../../../widget-shell/views";
import { getYieldFlowAttribution } from "../../../model/yield-transaction-flow";
import { getYieldTransactionCompletionUrls } from "../../../model/yield-transaction-workflow";
import {
  useYieldFlowExecution,
  useYieldFlowSession,
} from "../../../react/yield-flow-route";

export const useComplete = () => {
  const execution = useYieldFlowExecution();
  const session = useYieldFlowSession();
  const finish = useAtomSet(execution.finishAtom);
  const viewPosition = useAtomSet(execution.viewPositionAtom);
  const positionBalanceId = useAtomValue(execution.positionBalanceIdAtom);
  const positionTotal = useAtomValue(execution.positionTotalAtom);
  const workflowView = useAtomValue(execution.workflow.viewAtom);

  // Ledger Live desktop leaves for its Earn dashboard; elsewhere the flow finishes in the widget.
  const opensLedgerEarn = (useSKWallet()?.isLedgerLive ?? false) && !isMobile();

  const urls = workflowView.state
    ? getYieldTransactionCompletionUrls(workflowView.state.context)
    : [];

  const trackEvent = useTrackEvent();
  // The explorer link opens the transaction itself; the visit is recorded.
  const onViewTransactionClick = () => trackEvent("viewTxClicked");

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

  // Once the portfolio holds the position the flow acted on, it leads there;
  // Ledger Live's own dashboard shows positions instead.
  const viewPositionCta: PageCta =
    positionBalanceId && !opensLedgerEarn
      ? {
          disabled: false,
          isLoading: false,
          label: t("complete.view_position"),
          onClick: () => viewPosition(undefined),
        }
      : null;

  return {
    /** Who ran the action, as Review and Steps named them. */
    attribution: getYieldFlowAttribution(session.intake),
    urls,
    unstakeMatch: unstake,
    pendingActionMatch: pendingAction,
    onViewTransactionClick,
    cta: resolveCta(),
    positionTotal,
    viewPositionCta,
  };
};
