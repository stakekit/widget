import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Spinner, Stack, Text } from "../../../../../ui/index";
import {
  type PositionDetailsActionMode,
  positionDetailsHubHasContent,
  resolvePositionDetailsActionCapabilities,
  resolveSelectedPositionDetailsActionMode,
  shouldShowPositionDetailsActionTabs,
} from "../../../model/hub";
import { usePositionDetails } from "../../../react/use-position-details";
import { PositionDetailsExitActions } from "../../components/position-details-exit-actions";
import { PositionDetailsPendingActions } from "../../components/position-details-pending-actions";
import { PositionDetailsValidatorModal } from "../../components/position-details-validator-modal";
import { PositionDetailsActionTabs } from "./position-details-action-tabs";
import { PositionDetailsEnterActions } from "./position-details-enter-actions";

export const PositionDetailsHub = () => {
  const { t } = useTranslation();
  const positionDetails = usePositionDetails();
  // Ephemeral tab disclosure: must reset when the hub remounts after a flow
  // (locked design). Not Atom-backed — that would restore the last tab across
  // remounts.
  const [selectedMode, setSelectedMode] =
    useState<PositionDetailsActionMode | null>(null);

  if (positionDetails.isLoading) {
    return (
      <Stack grow align="center" justify="center">
        <Spinner />
      </Stack>
    );
  }

  if (
    !positionDetails.integrationData ||
    !positionDetails.positionBalancesByType
  ) {
    return null;
  }

  const capabilities =
    resolvePositionDetailsActionCapabilities(positionDetails);
  const mode = resolveSelectedPositionDetailsActionMode({
    ...capabilities,
    selectedMode,
  });

  if (!positionDetailsHubHasContent(positionDetails)) {
    return (
      <Stack grow align="center" justify="center">
        <Text tone="muted">{t("dashboard.position_details.no_actions")}</Text>
      </Stack>
    );
  }

  return (
    <Stack grow gap={12}>
      {shouldShowPositionDetailsActionTabs(capabilities) ? (
        <PositionDetailsActionTabs
          {...capabilities}
          integration={positionDetails.integrationData}
          selectedMode={mode ?? "exit"}
          onSelectMode={setSelectedMode}
        />
      ) : null}

      <PositionDetailsPendingActions
        flagsInvalidAmount={false}
        humanizesUntranslatedLabels
        positionDetails={positionDetails}
      />

      {mode === "exit" ? <PositionDetailsExitActions /> : null}
      {mode === "enter" ? <PositionDetailsEnterActions /> : null}

      <PositionDetailsValidatorModal />
    </Stack>
  );
};
