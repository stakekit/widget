import BigNumber from "bignumber.js";
import { Just } from "purify-ts";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import * as CopyText from "../../../components/atoms/copy-text";
import type { RewardTypes } from "../../../domain/types/reward-rate";
import type { TokenDto } from "../../../domain/types/tokens";
import type { ValidatorDto } from "../../../domain/types/validators";
import { APToPercentage, formatAddress, formatNumber } from "../../../utils";
import {
  getRewardRateFormatted,
  getRewardTypeFormatted,
} from "../../../utils/formatters";
import { SKAnchor } from "../../atoms/anchor";
import { Box } from "../../atoms/box";
import { Text } from "../../atoms/typography/text";
import { addressHover, addressParent } from "./styles.css";

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
  subnetName?: ValidatorDto["subnetName"];
  marketCap?: ValidatorDto["marketCap"];
  tokenSymbol?: ValidatorDto["tokenSymbol"];
  stakedBalanceToken: TokenDto | undefined;
  rewardRate: number | undefined;
  rewardType: RewardTypes | undefined;
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
        rewardRate && rewardType
          ? {
              title: getRewardTypeFormatted(rewardType),
              val: getRewardRateFormatted({
                rewardRate: rewardRate,
                rewardType: rewardType,
              }),
            }
          : null,
      stakedBalance:
        stakedBalance && stakedBalanceToken
          ? {
              title: t("details.validators_staked_balance"),
              val: Just(new BigNumber(stakedBalance))
                .filter((v) => !v.isNaN())
                .map(
                  (v) => `${formatNumber(v, 0)} ${stakedBalanceToken.symbol}`
                )
                .orDefault("-"),
            }
          : null,
      votingPower: votingPower
        ? {
            title: t("details.validators_voting_power"),
            val: Just(new BigNumber(votingPower))
              .filter((v) => !v.isNaN())
              .map((v) => `${APToPercentage(v.toNumber())}%`)
              .orDefault("-"),
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
            val: Just(new BigNumber(commission))
              .filter((v) => !v.isNaN())
              .map((v) => `${formatNumber(APToPercentage(v.toNumber()))}%`)
              .orDefault("-"),
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
