import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { YieldPendingActionType } from "../../../../../domain/action/pending-action";
import { humanizePendingActionType } from "../../../../../shared/lib/formatters";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Spinner } from "../../../../../shared/ui/primitives/spinner";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import {
  type PositionDetailsActionMode,
  positionDetailsHubHasContent,
  resolvePositionDetailsActionCapabilities,
  resolveSelectedPositionDetailsActionMode,
  shouldShowPositionDetailsActionTabs,
} from "../../../model/hub";
import { AmountBlock } from "../../classic/components/amount-block";
import { PositionDetailsUnstakeActions } from "../../classic/components/position-details-unstake-actions";
import { PositionDetailsValidatorModal } from "../../classic/components/position-details-validator-modal";
import { StaticActionBlock } from "../../classic/components/static-action-block";
import { usePositionDetails } from "../../classic/hooks/use-position-details";
import { PositionDetailsActionTabs } from "./position-details-action-tabs";
import { PositionDetailsStakeActions } from "./position-details-stake-actions";
import { container } from "./styles.css";

const PositionDetailsPendingActions = ({
  positionDetails,
}: {
  positionDetails: ReturnType<typeof usePositionDetails>;
}) => {
  const { t } = useTranslation();
  const {
    integrationData: integrationDataValue,
    pendingActions: pendingActionsValue,
    onPendingActionAmountChange,
    onPendingActionClick,
  } = positionDetails;

  if (!integrationDataValue || !pendingActionsValue?.length) return null;

  return (
    <>
      {pendingActionsValue.map((val) =>
        val.amount ? (
          <AmountBlock
            key={`${val.pendingAction.type}-${val.pendingAction.passthrough}`}
            variant="action"
            onAmountChange={(amount) =>
              onPendingActionAmountChange({
                balanceType: val.yieldBalance.type,
                token: val.yieldBalance.token,
                actionType: val.pendingAction.type,
                passthrough: val.pendingAction.passthrough,
                amount,
              })
            }
            value={val.amount}
            canChangeAmount
            onClick={() =>
              onPendingActionClick({
                pendingAction: val.pendingAction,
                yieldBalance: val.yieldBalance,
              })
            }
            label={t(
              `position_details.pending_action_button.${
                val.pendingAction.type.toLowerCase() as Lowercase<YieldPendingActionType>
              }`,
              {
                defaultValue: humanizePendingActionType(val.pendingAction.type),
              }
            )}
            onMaxClick={null}
            formattedAmount={val.formattedAmount}
            balance={null}
          />
        ) : (
          <StaticActionBlock
            {...val}
            key={`${val.pendingAction.type}-${val.pendingAction.passthrough}`}
            onPendingActionClick={onPendingActionClick}
            yieldId={integrationDataValue.id}
          />
        )
      )}
    </>
  );
};

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
      <Box
        className={container}
        display="flex"
        justifyContent="center"
        alignItems="center"
      >
        <Spinner />
      </Box>
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
      <Box
        className={container}
        display="flex"
        justifyContent="center"
        alignItems="center"
      >
        <Text variant={{ type: "muted", weight: "normal" }}>
          {t("dashboard.position_details.no_actions")}
        </Text>
      </Box>
    );
  }

  return (
    <Box
      className={container}
      flex={1}
      display="flex"
      flexDirection="column"
      marginTop="3"
    >
      <Box display="flex" flex={1} flexDirection="column" gap="3">
        {shouldShowPositionDetailsActionTabs(capabilities) ? (
          <PositionDetailsActionTabs
            {...capabilities}
            selectedMode={mode ?? "unstake"}
            onSelectMode={setSelectedMode}
          />
        ) : null}

        <PositionDetailsPendingActions positionDetails={positionDetails} />

        {mode === "unstake" ? <PositionDetailsUnstakeActions /> : null}
        {mode === "stake" ? <PositionDetailsStakeActions /> : null}
      </Box>

      <PositionDetailsValidatorModal />
    </Box>
  );
};
