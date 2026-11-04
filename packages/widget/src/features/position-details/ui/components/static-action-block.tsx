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
import { humanizePendingActionType } from "../../../../shared/lib/formatters";
import { formatTokenAmount } from "../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../shared/react/widget-presentation";
import { Box, Button, Card, Stack, Text } from "../../../../ui/index";
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
};

export const StaticActionBlock = ({
  pendingAction,
  yieldBalance,
  onPendingActionClick,
  integration,
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

  return (
    // The CTA keeps a single-line label; when it and the text can't share a
    // row (narrow widget, long translations) it wraps below, at the end.
    <Card variant="outline" padding={16}>
      <Stack direction="row" align="center" justify="between" gap={12} wrap>
        <Box grow>
          <Stack gap={4}>
            <Text breakAnywhere>
              <Trans
                i18nKey="position_details.available_to"
                context={labelContext}
                values={{
                  amount: yieldBalance.isEncrypted
                    ? t("shared.confidential.hidden")
                    : formatTokenAmount(
                        cancelReturn?.amount ??
                          exactDecimal(yieldBalance.amount),
                        locale,
                        "down"
                      ),
                  symbol: (cancelReturn?.token ?? yieldBalance.token).symbol,
                  pendingAction: t(
                    `position_details.pending_action.${actionKey}`,
                    {
                      context: isEthenaUsdeStaking(integration.id)
                        ? "ethena_usde"
                        : undefined,
                      defaultValue: humanizePendingActionType(
                        pendingAction.type
                      ),
                    }
                  ),
                }}
                components={{ bold: <Text.Strong /> }}
              />
            </Text>
            {cancelReturn ? (
              <Text variant="caption" tone="muted">
                {t("position_details.cancel_returns", {
                  symbol: cancelReturn.token.symbol,
                })}
              </Text>
            ) : null}
          </Stack>
        </Box>

        <Button
          size="sm"
          onClick={() =>
            onPendingActionClick({
              yieldBalance: yieldBalance,
              pendingAction: pendingAction,
            })
          }
        >
          {t(`position_details.pending_action_button.${actionKey}`, {
            context: labelContext,
            defaultValue: humanizePendingActionType(pendingAction.type),
          })}
        </Button>
      </Stack>
    </Card>
  );
};
