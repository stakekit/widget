import type BigNumber from "bignumber.js";
import { Trans, useTranslation } from "react-i18next";
import type { PendingAction } from "../../../../../domain/action/models";
import type { YieldPendingActionType } from "../../../../../domain/action/pending-action";
import type {
  EarnBalance,
  EarnYieldWithProvider,
} from "../../../../../domain/earn/models";
import { isEthenaUsdeStaking } from "../../../../../domain/earn/yield";
import { exactDecimal } from "../../../../../domain/finance/exact";
import { humanizePendingActionType } from "../../../../../shared/lib/formatters";
import { defaultFormattedNumber } from "../../../../../shared/lib/number-format";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Button } from "../../../../../shared/ui/primitives/button";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import type { usePositionDetails } from "../hooks/use-position-details";

type StaticActionBlockProps = {
  pendingAction: PendingAction;
  yieldBalance: EarnBalance & {
    tokenPriceInUsd: BigNumber;
  };
  onPendingActionClick: ReturnType<
    typeof usePositionDetails
  >["onPendingActionClick"];
  yieldId: EarnYieldWithProvider["id"];
};

export const StaticActionBlock = ({
  pendingAction,
  yieldBalance,
  onPendingActionClick,
  yieldId,
}: StaticActionBlockProps) => {
  const { t } = useTranslation();

  return (
    <Box
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      px="4"
      py="4"
      borderRadius="2xl"
      borderColor="backgroundMuted"
      borderWidth={1}
      borderStyle="solid"
    >
      <Box flex={2}>
        <Text variant={{ weight: "normal" }}>
          <Trans
            i18nKey="position_details.available_to"
            values={{
              amount: defaultFormattedNumber(exactDecimal(yieldBalance.amount)),
              symbol: yieldBalance.token.symbol,
              pendingAction: t(
                `position_details.pending_action.${
                  pendingAction.type.toLowerCase() as Lowercase<YieldPendingActionType>
                }`,
                {
                  context: isEthenaUsdeStaking(yieldId)
                    ? "ethena_usde"
                    : undefined,
                  defaultValue: humanizePendingActionType(pendingAction.type),
                }
              ),
            }}
            components={{
              bold: <Box as="span" fontWeight="bold" display="block" />,
            }}
          />
        </Text>
      </Box>

      <Box
        flex={1}
        maxWidth="24"
        justifyContent="flex-end"
        display="flex"
        alignItems="center"
      >
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
          <Text>
            {t(
              `position_details.pending_action_button.${
                pendingAction.type.toLowerCase() as Lowercase<YieldPendingActionType>
              }`,
              {
                defaultValue: humanizePendingActionType(pendingAction.type),
              }
            )}
          </Text>
        </Button>
      </Box>
    </Box>
  );
};
