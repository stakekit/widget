import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Match } from "effect";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  type ActionType,
  ActionTypes,
  getActionInputToken,
  TransactionStatus,
} from "../../../../../domain/types/action";
import {
  getExtendedYieldType,
  getYieldTypeLabels,
  isUnstakeYieldType,
} from "../../../../../domain/types/yields";
import { defaultFormattedNumber } from "../../../../../shared/lib/number-format";
import { useTrackPage } from "../../../../tracking/react/use-track-page";
import type { PageCta } from "../../../../widget-shell/page-cta";
import { useClassicFlowReview } from "../../../react/classic-flow-route";
import type { LabelKey } from "../types";

export const useActionReview = () => {
  useTrackPage("stakeReview");
  const { t } = useTranslation();

  const facade = useClassicFlowReview();
  const review = useAtomValue(facade.activityReviewViewAtom);
  const selectedAction = review.action;
  const selectedYield = review.selectedYield;
  const confirmFlow = useAtomSet(facade.confirmAtom);

  const inputToken = useMemo(
    () =>
      getActionInputToken({
        actionDto: selectedAction,
        yieldDto: selectedYield,
      }) ?? null,
    [selectedAction, selectedYield]
  );

  const transactions = useMemo(
    () =>
      [...selectedAction.transactions].sort(
        (a, b) => (a.stepIndex ?? 0) - (b.stepIndex ?? 0)
      ),
    [selectedAction]
  );

  const onViewTransactionClick = (url: string) => window.open(url, "_blank");

  const stakeTitle = getYieldTypeLabels(selectedYield, t).review;

  const unstakeTitle = useMemo(() => {
    const yieldType = getExtendedYieldType(selectedYield);

    return isUnstakeYieldType(yieldType)
      ? (t("position_details.unstake") as string)
      : t("position_details.withdraw");
  }, [selectedYield, t]);

  const pendingActionTitle = useMemo(
    () =>
      t(
        `position_details.pending_action_button.${
          selectedAction.type.toLowerCase() as Lowercase<ActionType>
        }` as never
      ) as string,
    [selectedAction.type, t]
  );

  const title = useMemo(
    () =>
      Match.value(selectedAction.type).pipe(
        Match.when(ActionTypes.STAKE, () => stakeTitle),
        Match.when(ActionTypes.UNSTAKE, () => unstakeTitle),
        Match.orElse(() => pendingActionTitle)
      ),
    [selectedAction, stakeTitle, unstakeTitle, pendingActionTitle]
  );

  const amount = useMemo(
    () =>
      selectedAction.amount == null
        ? null
        : defaultFormattedNumber(selectedAction.amount),
    [selectedAction]
  );

  const labelKey: LabelKey = useMemo(() => {
    const waitingIndex = transactions.findIndex(
      (transaction) =>
        transaction.status === TransactionStatus.WAITING_FOR_SIGNATURE
    );
    return waitingIndex > 0 &&
      transactions[waitingIndex - 1]?.status === TransactionStatus.CONFIRMED
      ? "continue"
      : "retry";
  }, [transactions]);

  const cta = useMemo<PageCta>(
    () => ({
      label: t(`activity.review.${labelKey}`),
      onClick: () => confirmFlow(undefined),
      disabled: review.confirmDisabled,
      isLoading: review.confirmLoading,
      hide: review.actionExpired,
    }),
    [
      confirmFlow,
      labelKey,
      review.actionExpired,
      review.confirmDisabled,
      review.confirmLoading,
      t,
    ]
  );

  return {
    selectedYield,
    selectedAction,
    transactions,
    onViewTransactionClick,
    title,
    amount,
    inputToken,
    actionExpired: review.actionExpired,
    labelKey,
    cta,
  };
};
