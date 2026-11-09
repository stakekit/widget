import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ListRow, Stack, Switch, Text } from "../../../../../ui/index";
import {
  type BorrowPositionAction,
  findBorrowCollateralToggleAction,
  type getBorrowPositionDetailsModel,
} from "../../model/details";
import { useBorrowCollateralToggleForm } from "../../react/use-action-form";
import { borrowPositionActionHostHooks } from "../host-hooks";

type CollateralItem = ReturnType<
  typeof getBorrowPositionDetailsModel
>["collateralItems"][number];

const CollateralRow = ({
  item,
  note,
  toggle,
}: {
  readonly item: CollateralItem;
  readonly note?: ComponentProps<typeof ListRow>["note"];
  readonly toggle?: ReactNode;
}) => (
  <ListRow
    title={item.label}
    subtitle={item.supplyRate}
    value={item.balance}
    subvalue={item.balanceUsd}
    trailing={toggle}
    note={note}
  />
);

/**
 * Toggling starts the action's Review instead of applying at once; a toggle
 * the Risk Gate blocks cannot start Review, so it renders disabled with why.
 */
const ToggleableCollateralRow = ({
  action,
  item,
  onActionSelect,
}: {
  readonly action: BorrowPositionAction;
  readonly item: CollateralItem;
  readonly onActionSelect: (action: BorrowPositionAction) => void;
}) => {
  const { t } = useTranslation();
  const form = useBorrowCollateralToggleForm(action);
  const riskBlock = form?.riskBlock ?? null;

  return (
    <CollateralRow
      item={item}
      note={
        riskBlock
          ? {
              text: t(
                `dashboard.borrow.position_details.validation.collateral_toggle_risk.${riskBlock}`
              ),
              tone: "danger",
            }
          : undefined
      }
      toggle={
        <Switch
          checked={item.isCollateral}
          onCheckedChange={() => onActionSelect(action)}
          label={action.label}
          labelHidden
          disabled={form !== null && !form.canSubmit}
          testId={`borrow-collateral-toggle__${action.type}`}
          hostHook={borrowPositionActionHostHooks[action.type]}
        />
      }
    />
  );
};

export const CollateralList = ({
  actions,
  items,
  onActionSelect,
}: {
  readonly actions: BorrowPositionAction[];
  readonly items: ReadonlyArray<CollateralItem>;
  readonly onActionSelect: (action: BorrowPositionAction) => void;
}) => {
  const { t } = useTranslation();

  if (items.length === 0) {
    return null;
  }

  return (
    <Stack gap={8}>
      <Text variant="label" tone="muted">
        {t("dashboard.borrow.position_details.collateral_list")}
      </Text>
      {items.map((item) => {
        const toggleAction = findBorrowCollateralToggleAction({
          actions,
          item,
        });

        return toggleAction ? (
          <ToggleableCollateralRow
            key={item.id}
            action={toggleAction}
            item={item}
            onActionSelect={onActionSelect}
          />
        ) : (
          <CollateralRow key={item.id} item={item} />
        );
      })}
    </Stack>
  );
};
