import { useTrackPage } from "@sk-widget/hooks/tracking/use-track-page";
import { useActivityContext } from "@sk-widget/providers/activity-provider";
import { useSelector } from "@xstate/store/react";
import { List, Maybe } from "purify-ts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useRegisterFooterButton } from "../../components/footer-outlet/context";

export const useFailedReview = () => {
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

  const errorsList = useMemo(
    () =>
      Maybe.of(selectedAction)
        .map((action) => action.transactions)
        .map((transactions) =>
          transactions.filter((t) => t.status === "FAILED")
        )
        .map((transaction) =>
          transaction.map((t) => Maybe.fromNullable(t.error).unsafeCoerce())
        ),
    [selectedAction]
  );

  useRegisterFooterButton(
    useMemo(
      () => ({
        label: t("activity.failed_review.retry"),
        onClick: () => navigate("/activity/steps"),
        disabled: false,
        isLoading: false,
      }),
      [navigate, t]
    )
  );

  return { errorsList, selectedYield };
};
