import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Stack, Text } from "../../../../../ui/index";
import {
  type PositionDetailsActionMode,
  positionDetailsHubHasContent,
  resolvePositionDetailsActionCapabilities,
  resolvePositionDetailsActionModes,
  resolveSelectedPositionDetailsActionMode,
} from "../../../model/hub";
import { usePositionDetails } from "../../../react/use-position-details";
import { PositionDetailsExitActions } from "../../components/position-details-exit-actions";
import { PositionDetailsPendingActions } from "../../components/position-details-pending-actions";
import { PositionDetailsSkeleton } from "../../components/position-details-skeleton";
import { PositionDetailsValidatorModal } from "../../components/position-details-validator-modal";
import { PositionDetailsActionTabs } from "./position-details-action-tabs";
import { PositionDetailsEnterActions } from "./position-details-enter-actions";

/**
 * The position's actions as tabs, exit, enter and each type of pending
 * action, with the selected action's form under them.
 */
export const PositionDetailsHub = () => {
  const { t } = useTranslation();
  const positionDetails = usePositionDetails();
  // Ephemeral tab disclosure: must reset when the hub remounts after a flow
  // (locked design). Not Atom-backed — that would restore the last tab across
  // remounts.
  const [selectedMode, setSelectedMode] =
    useState<PositionDetailsActionMode | null>(null);

  if (positionDetails.isLoading) return <PositionDetailsSkeleton />;

  if (
    !positionDetails.integrationData ||
    !positionDetails.positionBalancesByType
  ) {
    return null;
  }

  if (!positionDetailsHubHasContent(positionDetails)) {
    return (
      <Stack grow align="center" justify="center">
        <Text tone="muted">{t("dashboard.position_details.no_actions")}</Text>
      </Stack>
    );
  }

  const pendingActions = positionDetails.pendingActions ?? [];
  const modes = resolvePositionDetailsActionModes({
    ...resolvePositionDetailsActionCapabilities(positionDetails),
    pendingActionTypes: pendingActions.map(
      (action) => action.pendingAction.type
    ),
  });
  const mode = resolveSelectedPositionDetailsActionMode({
    modes,
    selectedMode,
  });

  return (
    <Stack grow gap={12}>
      {mode === null ? null : (
        <PositionDetailsActionTabs
          integration={positionDetails.integrationData}
          modes={modes}
          pendingActions={pendingActions}
          selectedMode={mode}
          onSelectMode={setSelectedMode}
        />
      )}

      {mode === "exit" ? <PositionDetailsExitActions /> : null}
      {mode === "enter" ? <PositionDetailsEnterActions /> : null}
      {mode !== null && mode !== "exit" && mode !== "enter" ? (
        <PositionDetailsPendingActions
          flagsInvalidAmount={false}
          humanizesUntranslatedLabels
          positionDetails={{
            ...positionDetails,
            pendingActions: pendingActions.filter(
              (action) => action.pendingAction.type === mode
            ),
          }}
        />
      ) : null}

      <PositionDetailsValidatorModal />
    </Stack>
  );
};
