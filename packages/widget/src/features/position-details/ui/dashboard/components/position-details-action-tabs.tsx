import { toLowerCase } from "effect/String";
import { useTranslation } from "react-i18next";
import {
  getPendingActionLabelContext,
  type YieldPendingActionType,
} from "../../../../../domain/action/pending-action";
import { isConfidentialYield } from "../../../../../domain/earn/confidential";
import type {
  EarnBalance,
  EarnYieldWithProvider,
} from "../../../../../domain/earn/models";
import {
  getExtendedYieldType,
  getYieldTypeLabels,
} from "../../../../../domain/earn/yield";
import { humanizePendingActionType } from "../../../../../shared/lib/formatters";
import { Tabs } from "../../../../../ui/index";
import type { PositionDetailsActionMode } from "../../../model/hub";

/**
 * Switches between the position's actions: exiting it, entering it further,
 * and each type of pending action, named as its button is. Hidden while
 * there is one action or none.
 */
export const PositionDetailsActionTabs = ({
  integration,
  modes,
  pendingActions,
  selectedMode,
  onSelectMode,
}: {
  readonly integration: EarnYieldWithProvider;
  readonly modes: ReadonlyArray<PositionDetailsActionMode>;
  /** The pending actions, so a pending action's tab reads as its button. */
  readonly pendingActions: ReadonlyArray<{
    readonly pendingAction: { readonly type: PositionDetailsActionMode };
    readonly yieldBalance: Pick<EarnBalance, "type">;
  }>;
  readonly selectedMode: PositionDetailsActionMode;
  readonly onSelectMode: (mode: PositionDetailsActionMode) => void;
}) => {
  const { t } = useTranslation();

  if (modes.length <= 1) return null;

  const exitLabel = t(
    `position_details.unstake_label.${getExtendedYieldType(integration)}`
  );
  const enterLabel = getYieldTypeLabels(integration, t).cta;
  const pendingLabelFor = (mode: YieldPendingActionType) => {
    const balanceType = pendingActions.find(
      (action) => action.pendingAction.type === mode
    )?.yieldBalance.type;
    const context =
      balanceType === undefined
        ? undefined
        : getPendingActionLabelContext(mode, balanceType, {
            confidential: isConfidentialYield(integration),
          });
    const label = t(
      `position_details.pending_action_button.${toLowerCase(mode)}`,
      {
        ...(context === undefined ? {} : { context }),
        defaultValue: humanizePendingActionType(mode),
      }
    );
    // A lending or vault exit already reads "Withdraw": the pending action's
    // tab names what it acts on, so no two tabs read the same.
    if (label !== exitLabel && label !== enterLabel) return label;
    return t(`position_details.pending_action_tab.${toLowerCase(mode)}`, {
      defaultValue: t("position_details.pending_action_tab.other", { label }),
    });
  };
  const labelFor = (mode: PositionDetailsActionMode) => {
    if (mode === "exit") return exitLabel;
    if (mode === "enter") return enterLabel;
    return pendingLabelFor(mode);
  };

  return (
    <Tabs
      tabs={modes.map((mode) => ({ value: mode, label: labelFor(mode) }))}
      value={selectedMode}
      onValueChange={onSelectMode}
      label={t("position_details.actions_label")}
    />
  );
};
