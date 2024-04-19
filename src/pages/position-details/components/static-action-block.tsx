import { Trans, useTranslation } from "react-i18next";
import { Box, Button, Spinner, Text } from "../../../components";
import { formatNumber } from "../../../utils";
import BigNumber from "bignumber.js";
import type {
  ActionTypes,
  PendingActionDto,
  YieldBalanceDto,
} from "@stakekit/api-hooks";
import type { usePositionDetails } from "../hooks/use-position-details";

type StaticActionBlockProps = {
  pendingActionDto: PendingActionDto;
  yieldBalance: YieldBalanceDto & {
    tokenPriceInUsd: BigNumber;
  };
  isLoading: boolean;
  onPendingActionClick: ReturnType<
    typeof usePositionDetails
  >["onPendingActionClick"];
};

export const StaticActionBlock = ({
  isLoading,
  pendingActionDto,
  yieldBalance,
  onPendingActionClick,
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
              amount: formatNumber(new BigNumber(yieldBalance.amount)),
              symbol: yieldBalance.token.symbol,
              pendingAction: t(
                `position_details.pending_action.${
                  pendingActionDto.type.toLowerCase() as Lowercase<ActionTypes>
                }`
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
        {isLoading && (
          <Box marginRight="3" display="flex">
            <Spinner />
          </Box>
        )}
        <Button
          variant={{
            size: "small",
            color: "smallButtonLight",
          }}
          disabled={isLoading}
          onClick={() =>
            onPendingActionClick({
              yieldBalance: yieldBalance,
              pendingActionDto: pendingActionDto,
            })
          }
        >
          <Text>
            {t(
              `position_details.pending_action_button.${
                pendingActionDto.type.toLowerCase() as Lowercase<ActionTypes>
              }`
            )}
          </Text>
        </Button>
      </Box>
    </Box>
  );
};
