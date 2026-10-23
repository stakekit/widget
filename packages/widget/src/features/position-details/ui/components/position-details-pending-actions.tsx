import { useTranslation } from "react-i18next";
import {
  getPendingActionLabelContext,
  type YieldPendingActionType,
} from "../../../../domain/action/pending-action";
import { isConfidentialYield } from "../../../../domain/earn/confidential";
import { humanizePendingActionType } from "../../../../shared/lib/formatters";
import { formatUsd } from "../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../shared/ui/widget-presentation";
import { AmountBlock } from "../classic/components/amount-block";
import { StaticActionBlock } from "../classic/components/static-action-block";
import type { usePositionDetails } from "../classic/hooks/use-position-details";

export const PositionDetailsPendingActions = ({
  positionDetails,
  presentation,
}: {
  readonly positionDetails: Pick<
    ReturnType<typeof usePositionDetails>,
    | "integrationData"
    | "pendingActions"
    | "onPendingActionAmountChange"
    | "onPendingActionClick"
  >;
  readonly presentation: "classic" | "dashboard";
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const {
    integrationData,
    pendingActions,
    onPendingActionAmountChange,
    onPendingActionClick,
  } = positionDetails;

  if (!integrationData || !pendingActions?.length) return null;

  return (
    <>
      {pendingActions.map((val) => {
        const key = `${val.pendingAction.type}-${val.pendingAction.passthrough}`;

        if (!val.amount) {
          return (
            <StaticActionBlock
              {...val}
              key={key}
              onPendingActionClick={onPendingActionClick}
              integration={integrationData}
            />
          );
        }

        const labelKey =
          `position_details.pending_action_button.${val.pendingAction.type.toLowerCase() as Lowercase<YieldPendingActionType>}` as const;
        const labelOptions = {
          context: getPendingActionLabelContext(
            val.pendingAction.type,
            val.yieldBalance.type,
            { confidential: isConfidentialYield(integrationData) }
          ),
        };
        // Classic flags invalid amounts; dashboard falls back to a humanized
        // label for action types without a translation.
        const label =
          presentation === "dashboard"
            ? t(labelKey, {
                ...labelOptions,
                defaultValue: humanizePendingActionType(val.pendingAction.type),
              })
            : t(labelKey, labelOptions);
        const unstakeAmountError =
          presentation === "classic" ? val.validation !== null : undefined;

        return (
          <AmountBlock
            key={key}
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
            label={label}
            onMaxClick={null}
            formattedAmount={
              val.amountUsd ? formatUsd(val.amountUsd, locale) : ""
            }
            balance={null}
            unstakeAmountError={unstakeAmountError}
          />
        );
      })}
    </>
  );
};
