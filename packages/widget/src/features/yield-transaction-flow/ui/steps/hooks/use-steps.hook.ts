import { useAtomSet } from "@effect/atom-react";
import { useTranslation } from "react-i18next";
import { useExecutionLeaveConfirmation } from "../../../../leave-confirmation/index";
import { useTrackEvent } from "../../../../tracking/index";
import { useConnectedWallet } from "../../../../wallet/index";
import type { PageCta } from "../../../../widget-shell/views";
import {
  useYieldFlowExecution,
  useYieldFlowSession,
} from "../../../react/yield-flow-route";
import { useStepsDetails, useStepsSummary } from "./use-steps-summary.hook";
import { useTransactionWorkflow } from "./use-transaction-workflow.hook";

export const useSteps = () => {
  const { dispatch, steps } = useTransactionWorkflow();
  const { destination } = useYieldFlowSession();
  const facade = useYieldFlowExecution();
  const returnFlowToReview = useAtomSet(facade.backAtom);
  const leaveConfirmation = useExecutionLeaveConfirmation(
    destination.completePath,
    { resumable: steps.resumable }
  );

  const trackEvent = useTrackEvent();
  const summary = useStepsSummary();
  const details = useStepsDetails();
  const wallet = useConnectedWallet();

  const onClick = () =>
    leaveConfirmation.confirm(() => {
      returnFlowToReview(undefined);
      trackEvent("actionStepsCancelled");
    });

  const retry = steps.retryable ? () => dispatch({ _tag: "Retry" }) : undefined;

  const { t } = useTranslation();

  const resolveCta = (): PageCta =>
    steps.txStates.length
      ? {
          disabled: false,
          isLoading: false,
          label: t("shared.cancel"),
          onClick,
          variant: "secondary",
        }
      : null;

  return {
    error: steps.error,
    numbered: steps.numbered,
    retry,
    txStates: steps.txStates,
    cta: resolveCta(),
    leaveConfirmationDialog: leaveConfirmation.dialog,
    summary,
    details,
    wallet,
    yieldId: steps.yieldId,
  };
};
