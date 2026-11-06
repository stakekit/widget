import { useTranslation } from "react-i18next";

import { Tabs, Text } from "../../../../../ui/index";
import {
  type BorrowPositionAction,
  isBorrowCollateralToggleAction,
} from "../../model/details";
import { useBorrowPositionContext } from "../context";
import { RepayActionForm } from "../forms/repay-action-form";
import { WithdrawActionForm } from "../forms/withdraw-action-form";
import { borrowPositionActionHostHooks } from "../host-hooks";

const BorrowPositionActionForm = ({
  action,
  focusRequest,
}: {
  readonly action: BorrowPositionAction;
  readonly focusRequest: number;
}) => {
  const context = action.pendingContext;

  switch (context.type) {
    case "repay":
      return (
        <RepayActionForm
          action={action}
          context={context}
          focusRequest={focusRequest}
        />
      );
    case "withdraw":
      return <WithdrawActionForm action={action} context={context} />;
    case "disableCollateral":
    case "enableCollateral":
      return null;
  }
};

/**
 * A market position's amount actions as tabs, Repay and Withdraw as the
 * position offers them, the selected one's form in their panel; with one
 * action, its form alone. Repay, the way out, is selected first. The page
 * owns the choice, so a link to an action and the risk alert's Repay select
 * it. The collateral switches stay with the collateral in the details. The
 * API offers no borrow or supply action on an open position, so there is no
 * Borrow more or Add collateral.
 */
export const BorrowPositionActionsPane = () => {
  const { t } = useTranslation();
  const {
    actions: positionActions,
    onSelectAction,
    selection,
  } = useBorrowPositionContext();
  const actions = positionActions.filter(
    (action) => !isBorrowCollateralToggleAction(action)
  );
  const action =
    actions.find((candidate) => candidate.id === selection.actionId) ??
    actions.find((candidate) => candidate.type === "repay") ??
    actions[0];

  if (action === undefined) {
    return (
      <Text as="p" tone="muted">
        {t("dashboard.borrow.position_details.no_actions")}
      </Text>
    );
  }

  const form = (
    <BorrowPositionActionForm
      key={action.id}
      action={action}
      focusRequest={selection.focusRequest}
    />
  );

  if (actions.length === 1) return form;

  return (
    <Tabs
      tabs={actions.map((candidate) => ({
        value: candidate.id,
        label: candidate.label,
        hostHook: borrowPositionActionHostHooks[candidate.type],
      }))}
      value={action.id}
      onValueChange={onSelectAction}
      label={t("position_details.actions_label")}
    >
      {form}
    </Tabs>
  );
};
