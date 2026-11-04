import { useTranslation } from "react-i18next";
import { widgetRoutes } from "../../../../services/navigation/widget-routes";
import { Button, Card, Stack, Text } from "../../../../ui/index";
import {
  useWidgetNavigate,
  useWidgetRouteMatch,
} from "../../../navigation/index";
import {
  type BorrowPositionAction,
  isBorrowCollateralToggleAction,
} from "../model/details";
import { BorrowPositionBreadcrumb } from "./components/breadcrumb";
import { useBorrowPositionContext } from "./context";
import { borrowPositionActionHostHooks } from "./host-hooks";

export const BorrowPositionActionsPage = () => {
  const { t } = useTranslation();
  const navigation = useWidgetNavigate();
  const marketId = useWidgetRouteMatch(widgetRoutes.borrowPosition)?.marketId;
  const {
    actions: positionActions,
    model,
    position,
  } = useBorrowPositionContext();
  const actions = positionActions.filter(
    (action) => !isBorrowCollateralToggleAction(action)
  );

  const onActionSelect = (action: BorrowPositionAction) => {
    if (!marketId) return;
    void navigation.push(
      widgetRoutes.borrowPositionAction.build("Dashboard", {
        actionId: action.id,
        marketId,
      })
    );
  };

  return (
    <>
      <BorrowPositionBreadcrumb positionName={model?.title ?? null} />

      <Stack gap={12}>
        <Text variant="heading" as="h3">
          {t("dashboard.borrow.position_details.actions_title")}
        </Text>

        {!position || actions.length === 0 ? (
          <Text as="p" tone="muted">
            {t("dashboard.borrow.position_details.no_actions")}
          </Text>
        ) : (
          actions.map((action) => (
            <Card key={action.id} padding={16}>
              <Stack direction="row" align="center" justify="between" gap={12}>
                <Stack gap={4} grow>
                  <Text weight="semibold">{action.label}</Text>
                  <Text variant="caption" tone="muted">
                    {t(
                      `dashboard.borrow.position_details.action_descriptions.${action.type}`
                    )}
                  </Text>
                </Stack>
                <Button
                  size="sm"
                  testId={`borrow-position-action__${action.type}`}
                  hostHook={borrowPositionActionHostHooks[action.type]}
                  onClick={() => onActionSelect(action)}
                >
                  {t("dashboard.borrow.position_details.configure_action")}
                </Button>
              </Stack>
            </Card>
          ))
        )}
      </Stack>
    </>
  );
};
