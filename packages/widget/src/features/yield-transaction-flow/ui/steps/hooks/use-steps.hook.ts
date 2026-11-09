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
  const leaveFlow = useAtomSet(facade.finishAtom);
  const leaveConfirmation = useExecutionLeaveConfirmation(
    destination.completePath,
    { resumable: steps.resumable }
  );

  const trackEvent = useTrackEvent();
  const summary = useStepsSummary();
  const details = useStepsDetails();
  const wallet = useConnectedWallet();

  const cancel = () =>
    leaveConfirmation.confirm(() => {
      returnFlowToReview(undefined);
      trackEvent("actionStepsCancelled");
    });
  // What is sent cannot be called back: leaving lets it run on, out of the
  // flow, rather than back to a Review that could send it again.
  const leave = () => leaveConfirmation.confirm(() => leaveFlow(undefined));

  const retry = steps.retryable ? () => dispatch({ _tag: "Retry" }) : undefined;

  const { t } = useTranslation();

  const resolveCta = (): PageCta => {
    if (!steps.txStates.length) return null;
    return {
      disabled: false,
      isLoading: false,
      label: steps.sent ? t("steps.leave") : t("shared.cancel"),
      onClick: steps.sent ? leave : cancel,
      variant: "secondary",
    };
  };

  return {
    error: steps.error,
    numbered: steps.numbered,
    retry,
    txStates: steps.txStates,
    cta: resolveCta(),
    /** Under the footer once a transaction is sent: why there is no Cancel. */
    ctaNote: steps.sent ? t("steps.sent_note") : null,
    leaveConfirmationDialog: leaveConfirmation.dialog,
    summary,
    details,
    wallet,
    yieldId: steps.yieldId,
  };
};
