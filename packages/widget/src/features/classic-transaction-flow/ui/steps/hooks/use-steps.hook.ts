import { useAtomSet } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useTranslation } from "react-i18next";
import { useTrackEvent } from "../../../../tracking/state";
import type { PageCta } from "../../../../widget-shell/components";
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
    retry,
    txStates: steps.txStates,
    cta: resolveCta(),
    customSignErrorMessage: setupError?.message ?? steps.customSignErrorMessage,
    yieldId: steps.yieldId,
  };
};
