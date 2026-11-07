import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Card, Stack, Switch, Text } from "../../../../../ui/index";
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

const CollateralRowLayout = ({
  item,
  note,
  toggle,
}: {
  readonly item: CollateralItem;
  readonly note?: string | null;
  readonly toggle?: ReactNode;
}) => (
  <Card padding={12}>
    <Stack gap={8}>
      <Stack direction="row" align="center" gap={12}>
        <Stack gap={2} grow>
          <Text weight="semibold" truncate>
            {item.label}
          </Text>
          <Text variant="caption" tone="muted" numeric>
            {item.supplyRate}
          </Text>
        </Stack>
        <Stack gap={2} align="end">
          <Text numeric>{item.balance}</Text>
          <Text variant="caption" tone="muted" numeric>
            {item.balanceUsd}
          </Text>
        </Stack>
        {toggle}
      </Stack>
      {note ? (
        <Text variant="caption" tone="danger">
          {note}
        </Text>
      ) : null}
    </Stack>
  </Card>
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
    <CollateralRowLayout
      item={item}
      note={
        riskBlock
          ? t(
              `dashboard.borrow.position_details.validation.collateral_toggle_risk.${riskBlock}`
            )
          : null
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
          <CollateralRowLayout key={item.id} item={item} />
        );
      })}
    </Stack>
  );
};
