import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { widgetRoutes } from "../../../../services/navigation/widget-routes";
import { Box } from "../../../../shared/ui/primitives/box";
import { Text } from "../../../../shared/ui/primitives/typography/text";
import { useWidgetRouteMatch } from "../../../navigation/index";
import { WidgetNavigate } from "../../../navigation/views";
import {
  type BorrowPositionAction,
  isBorrowCollateralToggleAction,
} from "../model/details";
import { BorrowPositionBreadcrumb } from "./components/breadcrumb";
import { useBorrowPositionContext } from "./context";
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
  const match = useWidgetRouteMatch(widgetRoutes.borrowPositionAction);
  const actionId = match?.actionId;
  const positionPath = match
    ? widgetRoutes.borrowPosition.build("Dashboard", {
        marketId: match.marketId,
      })
    : widgetRoutes.positions.build();
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
      return <WidgetNavigate replace to={positionPath} />;
    }

    return <BorrowPositionActionForm action={action} />;
  };
  const actionContent = getActionContent();

  return (
    <>
      <BorrowPositionBreadcrumb
        backPath={positionPath}
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
