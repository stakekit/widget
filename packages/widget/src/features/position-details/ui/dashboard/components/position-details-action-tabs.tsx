import { useTranslation } from "react-i18next";
import type { EarnYieldWithProvider } from "../../../../../domain/earn/models";
import {
  getExtendedYieldType,
  getYieldTypeLabels,
} from "../../../../../domain/earn/yield";
import { type TabOption, Tabs } from "../../../../../ui/index";
import type {
  PositionDetailsActionCapabilities,
  PositionDetailsActionMode,
} from "../../../model/hub";

/** Switches between exiting the position and entering it further. */
export const PositionDetailsActionTabs = ({
  canEnter,
  canExit,
  integration,
  selectedMode,
  onSelectMode,
}: PositionDetailsActionCapabilities & {
  integration: EarnYieldWithProvider;
  selectedMode: PositionDetailsActionMode;
  onSelectMode: (mode: PositionDetailsActionMode) => void;
}) => {
  const { t } = useTranslation();

  const tabs = [
    canExit
      ? {
          value: "exit" as const,
          label: t(
            `position_details.unstake_label.${getExtendedYieldType(integration)}`
          ),
        }
      : null,
    canEnter
      ? {
          value: "enter" as const,
          label: getYieldTypeLabels(integration, t).cta,
        }
      : null,
  ].filter((tab): tab is TabOption<PositionDetailsActionMode> => tab !== null);

  if (tabs.length <= 1) return null;

  return (
    <Tabs
      tabs={tabs}
      value={selectedMode}
      onValueChange={onSelectMode}
      label={t("position_details.actions_label")}
    />
  );
};
