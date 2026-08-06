import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { Box } from "../../../../../shared/ui/primitives/box";
import { pressAnimation } from "../../../../../shared/ui/primitives/button/styles.css";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import type {
  PositionDetailsActionCapabilities,
  PositionDetailsActionMode,
} from "../../../model/hub";
import * as styles from "./styles.css";

export const PositionDetailsActionTabs = ({
  canStake,
  canUnstake,
  selectedMode,
  onSelectMode,
}: PositionDetailsActionCapabilities & {
  selectedMode: PositionDetailsActionMode;
  onSelectMode: (mode: PositionDetailsActionMode) => void;
}) => {
  const { t } = useTranslation();

  const tabs = [
    canUnstake
      ? {
          id: "unstake" as const,
          label: t("dashboard.position_details.action_tabs.unstake"),
        }
      : null,
    canStake
      ? {
          id: "stake" as const,
          label: t("dashboard.position_details.action_tabs.stake"),
        }
      : null,
  ].filter((tab): tab is NonNullable<typeof tab> => !!tab);

  if (tabs.length <= 1) return null;

  return (
    <Box className={styles.actionTabs}>
      {tabs.map((tab) => {
        const isSelected = selectedMode === tab.id;

        return (
          <Box
            as="button"
            className={clsx(
              pressAnimation,
              styles.actionTab({
                state: isSelected ? "active" : "inactive",
              })
            )}
            data-testid={`position-details-action-tab-${tab.id}`}
            key={tab.id}
            onClick={() => {
              if (isSelected) return;
              onSelectMode(tab.id);
            }}
          >
            <Text
              className={styles.actionTabText}
              variant={{
                type: isSelected ? "regular" : "muted",
                weight: "semibold",
              }}
            >
              {tab.label}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
};
