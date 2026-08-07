import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { YieldPendingActionType } from "../../../../../domain/types/pending-action";
import { humanizePendingActionType } from "../../../../../shared/lib/formatters";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Spinner } from "../../../../../shared/ui/primitives/spinner";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import {
  type PositionDetailsActionMode,
  positionDetailsExitHasContent,
  positionDetailsHubHasContent,
  positionDetailsStakeHasContent,
  resolveSelectedPositionDetailsActionMode,
  shouldShowPositionDetailsActionTabs,
} from "../../../model/hub";
import { AmountBlock } from "../../classic/components/amount-block";
import { PositionDetailsUnstakeActions } from "../../classic/components/position-details-unstake-actions";
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
            key={`${val.pendingActionDto.type}-${val.pendingActionDto.passthrough}`}
            variant="action"
            onAmountChange={(amount) =>
              onPendingActionAmountChange({
                balanceType: val.yieldBalance.type,
                token: val.yieldBalance.token,
                actionType: val.pendingActionDto.type,
                passthrough: val.pendingActionDto.passthrough,
                amount,
              })
            }
            value={val.amount}
            canChangeAmount
            onClick={() =>
              onPendingActionClick({
                pendingActionDto: val.pendingActionDto,
                yieldBalance: val.yieldBalance,
              })
            }
            label={t(
              `position_details.pending_action_button.${
                val.pendingActionDto.type.toLowerCase() as Lowercase<YieldPendingActionType>
              }`,
              {
                defaultValue: humanizePendingActionType(
                  val.pendingActionDto.type
                ),
              }
            )}
            onMaxClick={null}
            formattedAmount={val.formattedAmount}
            balance={null}
          />
        ) : (
          <StaticActionBlock
            {...val}
            key={`${val.pendingActionDto.type}-${val.pendingActionDto.passthrough}`}
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
  // remounts. See ADR 0004 presentation-state exception.
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

  const capabilities = {
    canStake: positionDetailsStakeHasContent(positionDetails),
    canUnstake: positionDetails.canUnstake,
  };
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

        {mode === "unstake" &&
        positionDetailsExitHasContent(positionDetails) ? (
          <PositionDetailsUnstakeActions />
        ) : null}
        {mode === "stake" ? <PositionDetailsStakeActions /> : null}
      </Box>
    </Box>
  );
};
