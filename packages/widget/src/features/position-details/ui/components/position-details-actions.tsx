import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  getExtendedYieldType,
  getYieldTypeLabels,
} from "../../../../domain/earn/yield";
import { Stack, Tabs, Text } from "../../../../ui/index";
import {
  getLeadingPendingAction,
  type PositionDetailsAmountAction,
  positionDetailsHubHasContent,
  resolvePositionDetailsActionCapabilities,
  resolvePositionDetailsAmountActions,
} from "../../model/hub";
import { usePositionDetails } from "../use-position-details";
import { PositionDetailsExitActions } from "./position-details-exit-actions";
import { PositionDetailsPendingActions } from "./position-details-pending-actions";
import { PositionDetailsSkeleton } from "./position-details-skeleton";
import { PositionDetailsValidatorModal } from "./position-details-validator-modal";

/**
 * A position's actions under its summary: first a card for each one-click
 * action the position has, such as claiming rewards, the required one
 * leading, so it stays in view above the amount form; then the amount
 * actions (exit, and entering further where the Layout offers it) as
 * tabs, the exit selected first, the selected one's form in their panel;
 * with one action, its form alone. With a required action, the forms' calls
 * to action step down to secondary.
 */
export const PositionDetailsActions = ({
  renderEnter,
}: {
  /**
   * The form for entering further, in a Layout that offers it, with its
   * call to action's variant.
   */
  readonly renderEnter?: (ctaVariant: "primary" | "secondary") => ReactNode;
}) => {
  const { t } = useTranslation();
  const positionDetails = usePositionDetails();
  // Ephemeral choice: it resets when the page remounts after a flow, so the
  // page opens on the exit again. Not Atom-backed for that reason.
  const [chosen, setChosen] = useState<PositionDetailsAmountAction | null>(
    null
  );
  const { integrationData } = positionDetails;

  if (positionDetails.page._tag === "Loading") {
    return <PositionDetailsSkeleton />;
  }
  if (!integrationData || !positionDetails.positionBalancesByType) return null;

  if (!positionDetailsHubHasContent(positionDetails)) {
    return (
      <Text tone="muted">{t("dashboard.position_details.no_actions")}</Text>
    );
  }

  const pendingActions = positionDetails.pendingActions ?? [];
  const actions = resolvePositionDetailsAmountActions({
    ...resolvePositionDetailsActionCapabilities(positionDetails),
    offersEnter: renderEnter !== undefined,
  });
  const action =
    chosen !== null && actions.includes(chosen) ? chosen : actions[0];
  const ctaVariant =
    getLeadingPendingAction(pendingActions) === null ? "primary" : "secondary";
  const labels: Record<PositionDetailsAmountAction, string> = {
    enter: getYieldTypeLabels(integrationData, t).cta,
    exit: t(
      `position_details.unstake_label.${getExtendedYieldType(integrationData)}`
    ),
  };

  const form = (
    <Stack gap={12}>
      {action === "exit" ? (
        <PositionDetailsExitActions ctaVariant={ctaVariant} />
      ) : null}
      {action === "enter" && renderEnter ? renderEnter(ctaVariant) : null}
    </Stack>
  );

  return (
    <Stack gap={16}>
      <PositionDetailsPendingActions />

      {actions.length > 1 && action !== undefined ? (
        <Tabs
          tabs={actions.map((value) => ({ value, label: labels[value] }))}
          value={action}
          onValueChange={setChosen}
          label={t("position_details.actions_label")}
        >
          {form}
        </Tabs>
      ) : (
        form
      )}

      <PositionDetailsValidatorModal />
    </Stack>
  );
};
