import type BigNumber from "bignumber.js";
import { toLowerCase } from "effect/String";
import { Trans, useTranslation } from "react-i18next";
import type { PendingAction } from "../../../../domain/action/models";
import { getPendingActionLabelContext } from "../../../../domain/action/pending-action";
import { isConfidentialYield } from "../../../../domain/earn/confidential";
import { getPendingActionReturn } from "../../../../domain/earn/denomination";
import type {
  EarnBalance,
  EarnYieldWithProvider,
} from "../../../../domain/earn/models";
import { isEthenaUsdeStaking } from "../../../../domain/earn/yield";
import { exactDecimal } from "../../../../domain/finance/exact";
import { isPayoutPendingAction } from "../../../../domain/portfolio/position-callout";
import { humanizePendingActionType } from "../../../../shared/lib/formatters";
import { formatTokenAmount } from "../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../shared/react/widget-presentation";
import { ActionCard, Text } from "../../../../ui/index";
import type { usePositionDetails } from "../../react/use-position-details";

type StaticActionBlockProps = {
  pendingAction: PendingAction;
  yieldBalance: EarnBalance & {
    tokenPriceInUsd: BigNumber;
  };
  onPendingActionClick: ReturnType<
    typeof usePositionDetails
  >["onPendingActionClick"];
  integration: EarnYieldWithProvider;
  /** The page leads with this action: see `getLeadingPendingAction`. */
  primary: boolean;
};

export const StaticActionBlock = ({
  pendingAction,
  yieldBalance,
  onPendingActionClick,
  integration,
  primary,
}: StaticActionBlockProps) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const actionKey = toLowerCase(pendingAction.type);
  const labelContext = getPendingActionLabelContext(
    pendingAction.type,
    yieldBalance.type,
    { confidential: isConfidentialYield(integration) }
  );
  const cancelReturn = getPendingActionReturn(pendingAction.type, yieldBalance);
  // An amount paid out to the user is a gain, in the success tone.
  const figure = isPayoutPendingAction(pendingAction.type) ? (
    <Text as="strong" weight="semibold" tone="success" />
  ) : (
    <Text.Strong />
  );

  return (
    <ActionCard
      primary={primary}
      title={
        <Trans
          i18nKey="position_details.action_title"
          context={labelContext}
          values={{
            amount: yieldBalance.isEncrypted
              ? t("shared.confidential.hidden")
              : formatTokenAmount(
                  cancelReturn?.amount ?? exactDecimal(yieldBalance.amount),
                  locale,
                  "down"
                ),
            symbol: (cancelReturn?.token ?? yieldBalance.token).symbol,
            pendingAction: t(`position_details.pending_action.${actionKey}`, {
              context: isEthenaUsdeStaking(integration.id)
                ? "ethena_usde"
                : undefined,
              defaultValue: humanizePendingActionType(pendingAction.type),
            }),
          }}
          components={{ bold: figure }}
        />
      }
      {...(cancelReturn
        ? {
            description: t("position_details.cancel_returns", {
              symbol: cancelReturn.token.symbol,
            }),
          }
        : {})}
      action={{
        label: t(`position_details.pending_action_button.${actionKey}`, {
          context: labelContext,
          defaultValue: humanizePendingActionType(pendingAction.type),
        }),
        onClick: () => onPendingActionClick({ yieldBalance, pendingAction }),
      }}
    />
  );
};
