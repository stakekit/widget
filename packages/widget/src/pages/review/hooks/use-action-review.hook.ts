import { useTrackPage } from "@sk-widget/hooks/tracking/use-track-page";
import { useActivityContext } from "@sk-widget/providers/activity-provider";
import { MaybeWindow } from "@sk-widget/utils/maybe-window";
import { useSelector } from "@xstate/store/react";
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

  useRegisterFooterButton(
    useMemo(
      () => ({
        label: t("activity.review.retry"),
        onClick: () => navigate("/activity/steps"),
        disabled: false,
        isLoading: false,
      }),
      [navigate, t]
    )
  );

  return {
    selectedYield,
    selectedAction,
    transactions,
    onViewTransactionClick,
  };
};
