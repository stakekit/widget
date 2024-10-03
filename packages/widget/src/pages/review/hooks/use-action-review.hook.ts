import { useTrackPage } from "@sk-widget/hooks/tracking/use-track-page";
import { useYieldType } from "@sk-widget/hooks/use-yield-type";
import type { LabelKey } from "@sk-widget/pages/review/types";
import { useActivityContext } from "@sk-widget/providers/activity-provider";
import { defaultFormattedNumber } from "@sk-widget/utils";
import { dateOlderThen7Days } from "@sk-widget/utils/date";
import { MaybeWindow } from "@sk-widget/utils/maybe-window";
import {
  ActionTypes,
  type TokenDto,
  TransactionStatus,
} from "@stakekit/api-hooks";
import { useSelector } from "@xstate/store/react";
import { List, Maybe } from "purify-ts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useRegisterFooterButton } from "../../components/footer-outlet/context";

export const useActionReview = () => {
  useTrackPage("stakeReview");
  const navigate = useNavigate();
  const { t } = useTranslation();

  const selectedAction = useSelector(
    useActivityContext(),
    (state) => state.context.selectedAction
  ).unsafeCoerce();

  const inputToken = useMemo(
    () => Maybe.of(selectedAction.inputToken),
    [selectedAction]
  ) as Maybe<TokenDto>;

  const selectedYield = useSelector(
    useActivityContext(),
    (state) => state.context.selectedYield
  ).unsafeCoerce();

  const transactions = useMemo(
    () =>
      Maybe.fromNullable(selectedAction)
        .map((a) => a.transactions)
        .map((tx) => tx.sort((a, b) => a.stepIndex - b.stepIndex)),
    [selectedAction]
  );

  const onViewTransactionClick = (url: string) =>
    MaybeWindow.ifJust((w) => {
      w.open(url, "_blank");
    });

  const stakeTitle = useYieldType(Maybe.of(selectedYield)).mapOrDefault(
    (y) => y.review,
    ""
  );

  const unstakeTitle = useMemo(() => {
    switch (selectedYield.metadata.type) {
      case "staking":
      case "liquid-staking":
        return t("position_details.unstake") as string;

      default:
        return t("position_details.withdraw");
    }
  }, [selectedYield, t]);

  const pendingActionTitle = useMemo(
    () =>
      t(
        `position_details.pending_action_button.${
          selectedAction.type.toLowerCase() as Lowercase<ActionTypes>
        }` as const
      ),
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
      Maybe.fromNullable(selectedAction.amount)
        .map(defaultFormattedNumber)
        .extractNullable(),
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

  const labelKey: LabelKey = useMemo(
    () =>
      transactions
        .chain((txs) =>
          List.find(
            (tx) => tx.status === TransactionStatus.WAITING_FOR_SIGNATURE,
            txs
          ).chain((tx) =>
            List.findIndex((i) => i === tx, txs)
              .chainNullable((index) => txs[index - 1])
              .filter((prevTx) => prevTx.status === TransactionStatus.CONFIRMED)
              .map(() => "continue" as LabelKey)
          )
        )
        .orDefault("retry"),
    [transactions]
  );

  const actionOlderThan7Days = useMemo(
    () =>
      Maybe.of(selectedAction.createdAt)
        .map(dateOlderThen7Days)
        .orDefault(false),
    [selectedAction]
  );

  useRegisterFooterButton(
    useMemo(
      () => ({
        label: t(`activity.review.${labelKey}`),
        onClick: () => navigate(`/activity/${path}/steps`),
        disabled: false,
        isLoading: false,
        hide: actionOlderThan7Days,
      }),
      [navigate, path, labelKey, actionOlderThan7Days, t]
    )
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
  };
};
