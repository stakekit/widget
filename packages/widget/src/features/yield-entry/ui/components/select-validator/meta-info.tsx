import type BigNumber from "bignumber.js";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { ValidatorInput as ValidatorDto } from "../../../../../domain/earn/validator";
import { exactDecimal } from "../../../../../domain/finance/exact";
import type { Token } from "../../../../../domain/token/token";
import {
  getRewardRateFormatted,
  getRewardTypeFormatted,
} from "../../../../../shared/lib/formatters";
import {
  APToPercentage,
  formatAddress,
} from "../../../../../shared/lib/general";
import { formatNumber } from "../../../../../shared/lib/number-format";
import { SKAnchor } from "../../../../../shared/ui/primitives/anchor";
import { Box } from "../../../../../shared/ui/primitives/box";
import * as CopyText from "../../../../../shared/ui/primitives/copy-text";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { addressHover, addressParent } from "./styles.css";

type ValidatorSubnet = NonNullable<ValidatorDto["subnet"]>;

export const useMetaInfo = ({
  commission,
  stakedBalance,
  stakedBalanceToken,
  votingPower,
  address,
  rewardRate,
  rewardType,
  website,
  nominatorCount,
  subnetName,
  marketCap,
  tokenSymbol,
}: {
  commission?: ValidatorDto["commission"];
  stakedBalance?: ValidatorDto["tvl"];
  votingPower?: ValidatorDto["votingPower"];
  address?: ValidatorDto["address"];
  website?: ValidatorDto["website"];
  nominatorCount?: ValidatorDto["nominatorCount"];
  subnetName?: ValidatorSubnet["name"];
  marketCap?: ValidatorSubnet["tvl"];
  tokenSymbol?: ValidatorSubnet["tokenSymbol"];
  stakedBalanceToken: Token | undefined;
  rewardRate: BigNumber | number | undefined;
  rewardType: string | undefined;
}) => {
  const { t } = useTranslation();

  return useMemo<{
    stakedBalance: { title: string; val: ReactNode | string } | null;
    votingPower: { title: string; val: ReactNode | string } | null;
    commission: { title: string; val: ReactNode | string } | null;
    address: { title: string; val: ReactNode | string } | null;
    website: { title: string; val: ReactNode | string } | null;
    nominatorCount: { title: string; val: ReactNode | string } | null;
    subnetName: { title: string; val: ReactNode | string } | null;
    marketCap: { title: string; val: ReactNode | string } | null;
    tokenSymbol: { title: string; val: ReactNode | string } | null;
    rewardRate: { title: string; val: ReactNode | string } | null;
  }>(
    () => ({
      rewardRate:
        rewardRate != null && !exactDecimal(rewardRate).isZero() && rewardType
          ? {
              title: getRewardTypeFormatted(rewardType),
              val: getRewardRateFormatted({ rewardRate: rewardRate }),
            }
          : null,
      stakedBalance:
        stakedBalance && stakedBalanceToken
          ? {
              title: t("details.validators_staked_balance"),
              val: formatBigNumber(
                exactDecimal(stakedBalance),
                (value) =>
                  `${formatNumber(value, 0)} ${stakedBalanceToken.symbol}`
              ),
            }
          : null,
      votingPower: votingPower
        ? {
            title: t("details.validators_voting_power"),
            val: formatBigNumber(
              exactDecimal(votingPower),
              (value) => `${APToPercentage(value)}%`
            ),
          }
        : null,
      nominatorCount: Number.isInteger(nominatorCount)
        ? {
            title: t("details.validators_nominator_count"),
            val: nominatorCount,
          }
        : null,
      commission: commission
        ? {
            title: t("details.validators_comission"),
            val: formatBigNumber(
              exactDecimal(commission),
              (value) => `${APToPercentage(value)}%`
            ),
          }
        : null,
      address: address
        ? {
            title: t("details.validators_address"),
            val: (
              <CopyText.Provider text={address}>
                <CopyText.Root>
                  <Box display="flex" gap="1" className={addressParent}>
                    <Text
                      variant={{ type: "muted", weight: "normal" }}
                      className={addressHover}
                    >
                      {formatAddress(address, {
                        leadingChars: 8,
                        trailingChars: 8,
                      })}
                    </Text>

                    <CopyText.AnimatedContent>
                      <Box
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                      >
                        <CopyText.Icons hw={16} />
                      </Box>
                    </CopyText.AnimatedContent>
                  </Box>
                </CopyText.Root>
              </CopyText.Provider>
            ),
          }
        : null,
      website: website
        ? {
            title: t("details.validators_website"),
            val: (
              <SKAnchor href={website}>
                {formatAddress(website, {
                  leadingChars: 16,
                  trailingChars: 8,
                })}
              </SKAnchor>
            ),
          }
        : null,
      subnetName: subnetName
        ? {
            title: t("details.validators_subnet_name"),
            val: subnetName,
          }
        : null,
      marketCap: marketCap
        ? {
            title: t("details.validators_market_cap"),
            val: formatNumber(marketCap, 2),
          }
        : null,
      tokenSymbol: tokenSymbol
        ? {
            title: t("details.validators_token_symbol"),
            val: tokenSymbol,
          }
        : null,
    }),
    [
      rewardRate,
      rewardType,
      stakedBalance,
      stakedBalanceToken,
      t,
      votingPower,
      commission,
      address,
      website,
      nominatorCount,
      subnetName,
      marketCap,
      tokenSymbol,
    ]
  );
};

const formatBigNumber = (
  value: BigNumber,
  format: (value: BigNumber) => string
) => (value.isNaN() ? "-" : format(value));
