import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { widgetRoutes } from "../../../../services/navigation/widget-routes";
import { formatTokenAmount } from "../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../shared/react/widget-presentation";
import { ActionCard, Stack, Text } from "../../../../ui/index";
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

/**
 * What an action card is about: the debt a repay settles, or the collateral
 * a withdraw can take when there is one kind; else the action's name.
 */
const getActionTitle = (
  action: BorrowPositionAction,
  locale: string,
  t: TFunction
) => {
  const context = action.pendingContext;
  if (context.type === "repay") {
    return t("dashboard.borrow.position_details.outstanding_debt", {
      amount: formatTokenAmount(context.debtBalance.balance, locale, "up"),
      symbol: context.debtBalance.tokenSymbol,
    });
  }
  const [onlyToken, ...otherTokens] =
    context.type === "withdraw" ? context.tokens : [];
  if (onlyToken !== undefined && otherTokens.length === 0) {
    return t("dashboard.borrow.position_details.withdrawable", {
      amount: formatTokenAmount(onlyToken.availableAmount, locale, "down"),
      symbol: onlyToken.supplyBalance.tokenSymbol,
    });
  }
  return action.label;
};

export const BorrowPositionActionsPage = () => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
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
          <Stack gap={8}>
            {actions.map((action) => (
              <ActionCard
                key={action.id}
                title={getActionTitle(action, locale, t)}
                description={t(
                  `dashboard.borrow.position_details.action_descriptions.${action.type}`
                )}
                action={{
                  // The button names the verb, so sibling cards read apart.
                  label: action.label,
                  onClick: () => onActionSelect(action),
                  testId: `borrow-position-action__${action.type}`,
                  hostHook: borrowPositionActionHostHooks[action.type],
                }}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </>
  );
};
