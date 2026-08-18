import { useAtomValue } from "@effect/atom-react";
import type { YieldAction } from "../../../../../domain/action/models";
import type { Token } from "../../../../../domain/token/token";
import { defaultFormattedNumber } from "../../../../../shared/lib/number-format";
import { useTrackPage } from "../../../../tracking/index";
import {
  YieldSummaryKey,
  yieldSummaryAtom,
} from "../../../../yield-summary/index";
import type { ClassicTransactionFlowIntake } from "../../../model/classic-transaction-flow";
import {
  useClassicFlowExecution,
  useClassicFlowSession,
} from "../../../react/classic-flow-route";

type ActivityIntake = Extract<
  ClassicTransactionFlowIntake,
  { readonly _tag: "ActivityResume" }
>;

type ActivityCompleteView<Action> = Pick<
  ActivityIntake,
  "selectedValidators" | "selectedYield"
> & {
  readonly inputToken: Token | null;
  readonly selectedAction: Action;
};

export const useActivityCompleteView = <
  Action extends Pick<YieldAction, "amount" | "type" | "yieldId">,
>({
  selectedAction,
  selectedValidators,
  selectedYield,
  inputToken,
}: ActivityCompleteView<Action>) => {
  useTrackPage("activityComplete");
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
  return useAtomValue(execution.activityCompleteViewAtom);
};

export const useActivityHistoryComplete = () => {
  const session = useClassicFlowSession();
  const view = useAtomValue(session.activityHistoryViewAtom);
  return useActivityCompleteView(view);
};
