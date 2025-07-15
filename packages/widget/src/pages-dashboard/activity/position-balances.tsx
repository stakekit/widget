import type { YieldBalanceDto, YieldDto } from "@stakekit/api-hooks";
import type BigNumber from "bignumber.js";
import { useTranslation } from "react-i18next";
import { Box } from "../../components/atoms/box";
import { TokenIcon } from "../../components/atoms/token-icon";
import { Text } from "../../components/atoms/typography/text";
import { defaultFormattedNumber } from "../../utils";

export const PositionBalances = ({
  yieldBalance,
  integrationData,
}: {
  yieldBalance: YieldBalanceDto & { tokenPriceInUsd: BigNumber };
  integrationData: YieldDto;
}) => {
  const { t } = useTranslation();

  const yieldType = integrationData.metadata.type;

  const balanceTypeContext =
    yieldType === "vault" || yieldType === "lending"
      ? "yearn_or_deposit"
      : undefined;

  return (
    <Box
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      gap="4"
    >
      <Text variant={{ weight: "normal" }}>
        {t(`position_details.balance_type.${yieldBalance.type}`, {
          context: balanceTypeContext,
        })}
      </Text>

      <Box textAlign="end">
        <Box display="flex" gap="1" alignItems="center">
          {yieldBalance.token.isPoints && (
            <Box as="span" display="inline-flex">
              <TokenIcon
                token={yieldBalance.token}
                hideNetwork
                tokenLogoHw="5"
              />
            </Box>
          )}
          <Text
            overflowWrap="anywhere"
            variant={{ type: "muted", weight: "normal" }}
          >
            {yieldBalance.token.symbol}
            {!yieldBalance.token.isPoints &&
              ` ($${defaultFormattedNumber(yieldBalance.tokenPriceInUsd)})`}
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
