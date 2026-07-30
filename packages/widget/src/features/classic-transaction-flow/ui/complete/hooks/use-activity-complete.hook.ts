import { useAtomValue } from "@effect/atom-react";
import type { YieldAction } from "../../../../../domain/schema/action-models";
import { getActionInputToken } from "../../../../../domain/types/action";
import { defaultFormattedNumber } from "../../../../../shared/lib/number-format";
import { useTrackPage } from "../../../../tracking/state";
import {
  YieldSummaryKey,
  yieldSummaryAtom,
} from "../../../../yield-summary/state";
import type { ClassicTransactionFlowIntake } from "../../../model/classic-transaction-flow";
import {
  useClassicFlowExecution,
  useClassicFlowSession,
} from "../../../react/classic-flow-route";

type ActivityIntake = Extract<
  ClassicTransactionFlowIntake,
  { readonly _tag: "ActivityResume" }
>;

type ActivityCompleteView = Pick<
  ActivityIntake,
  "selectedValidators" | "selectedYield"
> & {
  readonly selectedAction: YieldAction;
};

const useActivityCompleteView = ({
  selectedAction,
  selectedValidators,
  selectedYield,
}: ActivityCompleteView) => {
  useTrackPage("activityComplete");

  const inputToken = getActionInputToken({
    actionDto: selectedAction,
    yieldDto: selectedYield,
  });
  const yieldSummary = useAtomValue(
    yieldSummaryAtom(
      new YieldSummaryKey({
        yield: selectedYield,
        validators: selectedValidators,
        selectedProviderYieldId: selectedAction.yieldId,
      })
    )
  );

  return {
    amount: defaultFormattedNumber(selectedAction.amount ?? 0),
    inputToken: inputToken ?? null,
    metadata: selectedYield
      ? {
          logoURI: selectedYield.metadata.logoURI,
          name: selectedYield.metadata.name,
          provider: selectedYield.provider,
        }
      : null,
    network: inputToken?.symbol ?? "",
    providerDetails: yieldSummary.providers,
    selectedAction,
    yieldType: yieldSummary.yieldType,
  };
};

export const useActivityComplete = () => {
  const execution = useClassicFlowExecution();
  const view = useAtomValue(execution.activityCompleteViewAtom);
  return useActivityCompleteView(view);
};

export const useActivityHistoryComplete = () => {
  const session = useClassicFlowSession();
  const view = useAtomValue(session.activityHistoryViewAtom);
  return useActivityCompleteView(view);
};
