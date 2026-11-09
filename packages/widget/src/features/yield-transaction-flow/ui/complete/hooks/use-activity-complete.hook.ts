import { useAtomValue } from "@effect/atom-react";
import type BigNumber from "bignumber.js";

import type { YieldAction } from "../../../../../domain/earn/action-models";
import type { Token } from "../../../../../domain/token/token";
import { formatTokenAmount } from "../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import {
  YieldSummaryKey,
  yieldSummaryAtom,
} from "../../../../yield-summary/index";
import type { YieldTransactionFlowIntake } from "../../../model/intake";
import { useYieldFlowExecution } from "../../yield-flow-session";

type ActivityIntake = Extract<
  YieldTransactionFlowIntake,
  { readonly _tag: "YieldActionContinuation" }
>;

type ActivityCompleteView<Action> = Pick<
  ActivityIntake,
  "selectedValidators" | "selectedYield"
> & {
  readonly inputToken: Token | null;
  readonly selectedAction: Action;
};

export const useActivityCompleteView = <
  Action extends {
    readonly amount: BigNumber | string | null;
    readonly intent: YieldAction["intent"];
    readonly type: YieldAction["type"];
    readonly yieldId: YieldAction["yieldId"];
  },
>({
  selectedAction,
  selectedValidators,
  selectedYield,
  inputToken,
}: ActivityCompleteView<Action>) => {
  const { locale } = useWidgetPresentation();
  const yieldSummary = useAtomValue(
    yieldSummaryAtom(
      new YieldSummaryKey({
        yield: selectedYield,
        validators: selectedValidators,
      })
    )
  );

  return {
    amount: formatTokenAmount(selectedAction.amount ?? 0, locale, "down"),
    network: inputToken?.symbol ?? "",
    selectedAction,
    yieldType: yieldSummary.yieldType,
  };
};

export const useActivityComplete = () => {
  const execution = useYieldFlowExecution();
  return useAtomValue(execution.activityCompleteViewAtom);
};
