import type BigNumber from "bignumber.js";
import { Trans, useTranslation } from "react-i18next";
import type { PendingAction } from "../../../../../domain/action/models";
import {
  getPendingActionLabelContext,
  type YieldPendingActionType,
} from "../../../../../domain/action/pending-action";
import {
  getCancelReturn,
  isConfidentialYield,
} from "../../../../../domain/earn/confidential";
import type {
  EarnBalance,
  EarnYieldWithProvider,
} from "../../../../../domain/earn/models";
import { isEthenaUsdeStaking } from "../../../../../domain/earn/yield";
import { exactDecimal } from "../../../../../domain/finance/exact";
import { humanizePendingActionType } from "../../../../../shared/lib/formatters";
import { formatTokenAmount } from "../../../../../shared/lib/number-format";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Button } from "../../../../../shared/ui/primitives/button";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { useWidgetPresentation } from "../../../../../shared/ui/widget-presentation";
import type { usePositionDetails } from "../hooks/use-position-details";
import { actionBlockCta, actionBlockText, noWrap } from "../styles.css";

type StaticActionBlockProps = {
  pendingAction: PendingAction;
  yieldBalance: EarnBalance & {
    tokenPriceInUsd: BigNumber;
  };
  onPendingActionClick: ReturnType<
    typeof usePositionDetails
  >["onPendingActionClick"];
  integration: EarnYieldWithProvider;
};

export const StaticActionBlock = ({
  pendingAction,
  yieldBalance,
  onPendingActionClick,
  integration,
}: StaticActionBlockProps) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const actionKey =
    pendingAction.type.toLowerCase() as Lowercase<YieldPendingActionType>;
  const labelContext = getPendingActionLabelContext(
    pendingAction.type,
    yieldBalance.type,
    { confidential: isConfidentialYield(integration) }
  );
  const cancelReturn = getCancelReturn(
    integration,
    pendingAction.type,
    yieldBalance
  );

  return (
    <Box
      display="flex"
      flexWrap="wrap"
      justifyContent="space-between"
      alignItems="center"
      gap="3"
      px="4"
      py="4"
      borderRadius="xl"
      borderColor="backgroundMuted"
      borderWidth={1}
      borderStyle="solid"
    >
      <Box className={actionBlockText}>
        <Text variant={{ weight: "normal" }}>
          <Trans
            i18nKey="position_details.available_to"
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
            components={{
              bold: <Box as="span" fontWeight="bold" display="block" />,
            }}
          />
        </Text>
        {cancelReturn ? (
          <Text variant={{ type: "muted", size: "small" }}>
            {t("position_details.cancel_returns", {
              symbol: cancelReturn.token.symbol,
            })}
          </Text>
        ) : null}
      </Box>

      <Box className={actionBlockCta}>
        <Button
          variant={{
            size: "small",
            color: "smallButtonLight",
          }}
          onClick={() =>
            onPendingActionClick({
              yieldBalance: yieldBalance,
              pendingAction: pendingAction,
            })
          }
        >
          <Text className={noWrap}>
            {t(`position_details.pending_action_button.${actionKey}`, {
              context: labelContext,
              defaultValue: humanizePendingActionType(pendingAction.type),
            })}
          </Text>
        </Button>
      </Box>
    </Box>
  );
};
