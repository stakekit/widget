import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import {
  type ActionType,
  ActionTypes,
  getActionInputToken,
  TransactionStatus,
} from "../../../domain/types/action";
import {
  getExtendedYieldType,
  isUnstakeYieldType,
} from "../../../domain/types/yields";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { useYieldType } from "../../../hooks/use-yield-type";
import {
  useActivitySelectedAction,
  useActivitySelectedYield,
} from "../../../providers/activity-provider";
import { defaultFormattedNumber } from "../../../utils";
import { dateOlderThen7Days } from "../../../utils/date";
import type { PageCta } from "../../components/page-cta";
import type { LabelKey } from "../types";

export const useActionReview = () => {
  useTrackPage("stakeReview");
  const navigate = useNavigate();
  const { t } = useTranslation();

  const selectedAction = useActivitySelectedAction()!;
  const selectedYield = useActivitySelectedYield()!;

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

  const stakeTitle = useYieldType(selectedYield)?.review ?? "";

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
      selectedAction.type === ActionTypes.STAKE
        ? stakeTitle
        : selectedAction.type === ActionTypes.UNSTAKE
          ? unstakeTitle
          : pendingActionTitle,
    [selectedAction, stakeTitle, unstakeTitle, pendingActionTitle]
  );

  const amount = useMemo(
    () =>
      selectedAction.amount == null
        ? null
        : defaultFormattedNumber(selectedAction.amount),
    [selectedAction]
  );

  const path = useMemo(
    () =>
      selectedAction.type === ActionTypes.UNSTAKE
        ? "unstake"
        : selectedAction.type === ActionTypes.STAKE
          ? "stake"
          : "pending",
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

  const actionOlderThan7Days = useMemo(
    () => dateOlderThen7Days(selectedAction.createdAt),
    [selectedAction]
  );

  const cta = useMemo<PageCta>(
    () => ({
      label: t(`activity.review.${labelKey}`),
      onClick: () => navigate(`/activity/${path}/steps`),
      disabled: false,
      isLoading: false,
      hide: actionOlderThan7Days,
    }),
    [navigate, path, labelKey, actionOlderThan7Days, t]
  );

  return {
    selectedYield,
    selectedAction,
    transactions,
    onViewTransactionClick,
    title,
    amount,
    inputToken,
    actionOlderThan7Days,
    labelKey,
    cta,
  };
};
