import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useUnstakeMatch } from "../../../../../shared/react/navigation/use-unstake-match";
import { useUnstakeOrPendingActionParams } from "../../../../../shared/react/navigation/use-unstake-or-pending-action-params";
import { Box } from "../../../../../shared/ui/primitives/box";
import { pressAnimation } from "../../../../../shared/ui/primitives/button/styles.css";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import * as styles from "./styles.css";

type PositionDetailsActionMode = "stake" | "unstake";

export const PositionDetailsActionTabs = ({
  canStake,
  canUnstake,
}: {
  canStake: boolean;
  canUnstake: boolean;
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { plain } = useUnstakeOrPendingActionParams();
  const unstakeMatch = useUnstakeMatch();
  const selectedMode: PositionDetailsActionMode = unstakeMatch
    ? "unstake"
    : "stake";

  const basePath = `/positions/${plain.integrationId}/${plain.balanceId}`;
  const tabs = [
    canStake
      ? ({
          id: "stake",
          label: t("dashboard.position_details.action_tabs.stake"),
          path: basePath,
        } satisfies {
          id: PositionDetailsActionMode;
          label: string;
          path: string;
        })
      : null,
    canUnstake
      ? ({
          id: "unstake",
          label: t("dashboard.position_details.action_tabs.unstake"),
          path: `${basePath}/unstake`,
        } satisfies {
          id: PositionDetailsActionMode;
          label: string;
          path: string;
        })
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

              navigate(tab.path, { replace: true });
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
