import { toLowerCase } from "effect/String";
import { useTranslation } from "react-i18next";

import { getPendingActionLabelContext } from "../../../../domain/action/pending-action";
import { isConfidentialYield } from "../../../../domain/earn/confidential";
import { humanizePendingActionType } from "../../../../shared/lib/formatters";
import { useWidgetPresentation } from "../../../../shared/react/widget-presentation";
import { Stack } from "../../../../ui/index";
import { getLeadingPendingAction } from "../../model/hub";
import { getPricedFiat } from "../../model/priced-fiat";
import { usePositionDetails } from "../../react/use-position-details";
import { AmountBlock } from "./amount-block";
import { StaticActionBlock } from "./static-action-block";

/**
 * A card for each pending action the position has, such as claiming
 * rewards or withdrawing what is unlocked; nothing when it has none. The
 * leading action (`getLeadingPendingAction`) comes first, as the page's
 * primary action.
 */
export const PositionDetailsPendingActions = () => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const {
    integrationData,
    pendingActions,
    onPendingActionAmountChange,
    onPendingActionClick,
  } = usePositionDetails();

  if (!integrationData || !pendingActions?.length) return null;

  // The leading action comes first, as the page's primary action.
  const leading = getLeadingPendingAction(pendingActions);
  const ordered = leading
    ? [leading, ...pendingActions.filter((action) => action !== leading)]
    : pendingActions;

  // Sibling action cards sit 8px apart, as one group.
  return (
    <Stack gap={8}>
      {ordered.map((val) => {
        const key = `${val.pendingAction.type}-${val.pendingAction.passthrough}`;
        const primary = val === leading;

        if (!val.amount) {
          return (
            <StaticActionBlock
              {...val}
              key={key}
              onPendingActionClick={onPendingActionClick}
              integration={integrationData}
              primary={primary}
            />
          );
        }

        const labelKey =
          `position_details.pending_action_button.${toLowerCase(val.pendingAction.type)}` as const;
        const labelContext = getPendingActionLabelContext(
          val.pendingAction.type,
          val.yieldBalance.type,
          { confidential: isConfidentialYield(integrationData) }
        );
        const labelOptions =
          labelContext === undefined ? {} : { context: labelContext };
        // Types the API adds before a translation exists read humanized.
        const label = t(labelKey, {
          ...labelOptions,
          defaultValue: humanizePendingActionType(val.pendingAction.type),
        });
        const exitAmountError = val.validation !== null;

        return (
          <AmountBlock
            key={key}
            variant="action"
            primary={primary}
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
            {...getPricedFiat({
              amountUsd: val.amountUsd,
              locale,
              status: val.amountUsdStatus,
            })}
            balance={null}
            exitAmountError={exitAmountError}
          />
        );
      })}
    </Stack>
  );
};
