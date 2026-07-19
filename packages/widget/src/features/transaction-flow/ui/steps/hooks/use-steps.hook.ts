import { useAtomSet } from "@effect/atom-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useSavedRef } from "../../../../../shared/react/use-saved-ref";
import { useTrackEvent } from "../../../../tracking/react/use-track-event";
import type { PageCta } from "../../../../widget-shell/page-cta";
import { classicTransactionFlowFacade } from "../../../state/classic-flow-facade";
import { useTransactionWorkflow } from "./use-transaction-workflow.hook";

export const useSteps = () => {
  const navigate = useNavigate();

  const { dispatch, flowIdentity, steps } = useTransactionWorkflow();
  const returnFlowToReview = useAtomSet(
    classicTransactionFlowFacade.returnToReviewAtom
  );

  const trackEvent = useTrackEvent();

  const onClick = () => {
    if (flowIdentity) returnFlowToReview(flowIdentity);
    trackEvent("actionStepsCancelled");
    navigate(-1);
  };

  const retry = steps.retryable ? () => dispatch({ _tag: "Retry" }) : undefined;

  const { t } = useTranslation();

  const onClickRef = useSavedRef(onClick);

  const cta = useMemo<PageCta>(
    () =>
      steps.txStates.length
        ? {
            disabled: false,
            isLoading: false,
            label: t("shared.cancel"),
            onClick: () => onClickRef.current(),
            variant: "secondary",
          }
        : null,
    [steps.txStates.length, t, onClickRef]
  );

  return {
    retry,
    txStates: steps.txStates,
    cta,
    customSignErrorMessage: steps.customSignErrorMessage,
    completionNavigation: steps.completionNavigation,
    yieldId: steps.yieldId,
  };
};
