import { useAtomSet } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSavedRef } from "../../../../../shared/react/use-saved-ref";
import { useTrackEvent } from "../../../../tracking/react/use-track-event";
import type { PageCta } from "../../../../widget-shell/page-cta";
import { useClassicFlowExecution } from "../../../react/classic-flow-route";
import { useTransactionWorkflow } from "./use-transaction-workflow.hook";

export const useSteps = () => {
  const { dispatch, result, steps } = useTransactionWorkflow();
  const facade = useClassicFlowExecution();
  const returnFlowToReview = useAtomSet(facade.backAtom);

  const trackEvent = useTrackEvent();

  const onClick = () => {
    returnFlowToReview(undefined);
    trackEvent("actionStepsCancelled");
  };

  const retry = steps.retryable ? () => dispatch({ _tag: "Retry" }) : undefined;
  const setupError = Option.getOrNull(AsyncResult.error(result));

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
    customSignErrorMessage: setupError?.message ?? steps.customSignErrorMessage,
    yieldId: steps.yieldId,
  };
};
