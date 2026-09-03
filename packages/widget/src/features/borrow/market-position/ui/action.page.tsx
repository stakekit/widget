import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useParams } from "react-router";
import { Box } from "../../../../shared/ui/primitives/box";
import { Text } from "../../../../shared/ui/primitives/typography/text";
import {
  type BorrowPositionAction,
  isBorrowCollateralToggleAction,
} from "../model/details";
import { BorrowPositionBreadcrumb } from "./components/breadcrumb";
import { getBorrowPositionBasePath, useBorrowPositionContext } from "./context";
import { RepayActionForm } from "./forms/repay-action-form";
import { WithdrawActionForm } from "./forms/withdraw-action-form";

const BorrowPositionActionForm = ({
  action,
}: {
  readonly action: BorrowPositionAction;
}) => {
  const context = action.pendingContext;

  switch (context.type) {
    case "repay":
      return <RepayActionForm action={action} context={context} />;
    case "withdraw":
      return <WithdrawActionForm action={action} context={context} />;
    case "disableCollateral":
    case "enableCollateral":
      return null;
  }
};

export const BorrowPositionActionPage = () => {
  const { actionId, marketId } = useParams();
  const { t } = useTranslation();
  const { actions, model, position } = useBorrowPositionContext();
  const action = actions.find((candidate) => candidate.id === actionId);
  const getActionContent = (): ReactNode => {
    if (!position || !action) {
      return (
        <Text variant={{ type: "muted", weight: "normal" }}>
          {t("dashboard.borrow.position_details.empty")}
        </Text>
      );
    }

    if (isBorrowCollateralToggleAction(action)) {
      return <Navigate replace to={getBorrowPositionBasePath(marketId)} />;
    }

    return <BorrowPositionActionForm action={action} />;
  };
  const actionContent = getActionContent();

  return (
    <>
      <BorrowPositionBreadcrumb
        backPath={getBorrowPositionBasePath(marketId)}
        positionName={model?.title ?? null}
      />

      <Box display="flex" flexDirection="column" gap="4" marginTop="3">
        <Box display="flex" flexDirection="column" gap="1">
          <Text variant={{ weight: "bold" }}>
            {action?.label ??
              t("dashboard.borrow.position_details.actions_title")}
          </Text>
          <Text variant={{ type: "muted", weight: "normal" }}>
            {model?.marketLabel}
          </Text>
        </Box>

        {actionContent}
      </Box>
    </>
  );
};
