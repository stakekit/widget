import { useTrackPage } from "@sk-widget/hooks/tracking/use-track-page";
import { useYieldType } from "@sk-widget/hooks/use-yield-type";
import { useActivityContext } from "@sk-widget/providers/activity-provider";
import { MaybeWindow } from "@sk-widget/utils/maybe-window";
import { ActionTypes } from "@stakekit/api-hooks";
import { useSelector } from "@xstate/store/react";
import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
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

  const selectedYield = useSelector(
    useActivityContext(),
    (state) => state.context.selectedYield
  ).unsafeCoerce();

  const transactions = useMemo(
    () => Maybe.fromNullable(selectedAction).map((a) => a.transactions),
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
        .map(BigNumber)
        .map((a) => a.toString())
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

  useRegisterFooterButton(
    useMemo(
      () => ({
        label: t("activity.review.retry"),
        onClick: () => navigate(`/activity/${path}/steps`),
        disabled: false,
        isLoading: false,
      }),
      [navigate, t, path]
    )
  );

  return {
    selectedYield,
    selectedAction,
    transactions,
    onViewTransactionClick,
    title,
    amount,
  };
};
