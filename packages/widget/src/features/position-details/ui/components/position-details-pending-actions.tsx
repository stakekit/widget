import { useTranslation } from "react-i18next";
import {
  getPendingActionLabelContext,
  type YieldPendingActionType,
} from "../../../../domain/action/pending-action";
import { isConfidentialYield } from "../../../../domain/earn/confidential";
import { humanizePendingActionType } from "../../../../shared/lib/formatters";
import { formatUsd } from "../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../shared/ui/widget-presentation";
import type { usePositionDetails } from "../../react/use-position-details";
import { AmountBlock } from "./amount-block";
import { StaticActionBlock } from "./static-action-block";

export const PositionDetailsPendingActions = ({
  flagsInvalidAmount,
  humanizesUntranslatedLabels,
  positionDetails,
}: {
  /** Whether an invalid pending-action amount is flagged on its block. */
  readonly flagsInvalidAmount: boolean;
  /** Whether action types without a translation fall back to a humanized label. */
  readonly humanizesUntranslatedLabels: boolean;
  readonly positionDetails: Pick<
    ReturnType<typeof usePositionDetails>,
    | "integrationData"
    | "pendingActions"
    | "onPendingActionAmountChange"
    | "onPendingActionClick"
  >;
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
        const label = humanizesUntranslatedLabels
          ? t(labelKey, {
              ...labelOptions,
              defaultValue: humanizePendingActionType(val.pendingAction.type),
            })
          : t(labelKey, labelOptions);
        const unstakeAmountError = flagsInvalidAmount
          ? val.validation !== null
          : undefined;

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
