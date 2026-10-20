import { useAtomSet } from "@effect/atom-react";
import { useTranslation } from "react-i18next";
import { useTrackEvent } from "../../../../tracking/index";
import type { PageCta } from "../../../../widget-shell/views";
import { useClassicFlowExecution } from "../../../react/classic-flow-route";
import { useTransactionWorkflow } from "./use-transaction-workflow.hook";

export const useSteps = () => {
  const { dispatch, steps } = useTransactionWorkflow();
  const facade = useClassicFlowExecution();
  const returnFlowToReview = useAtomSet(facade.backAtom);

  const trackEvent = useTrackEvent();

  const onClick = () => {
    returnFlowToReview(undefined);
    trackEvent("actionStepsCancelled");
  };

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
    cancelled: steps.cancelled,
    numbered: steps.numbered,
    retry,
    txStates: steps.txStates,
    cta: resolveCta(),
    customSignErrorMessage: steps.customSignErrorMessage,
    yieldId: steps.yieldId,
  };
};
