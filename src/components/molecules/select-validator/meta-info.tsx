import BigNumber from "bignumber.js";
import { Just } from "purify-ts";
import { ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  getRewardRateFormatted,
  getRewardTypeFormatted,
} from "../../../utils/formatters";
import { RewardTypes, ValidatorDto, YieldDto } from "@stakekit/api-hooks";
import { APToPercentage, formatAddress, formatNumber } from "../../../utils";
import { SKAnchor } from "../../atoms/anchor";

export const useMetaInfo = ({
  commission,
  stakedBalance,
  stakedBalanceToken,
  votingPower,
  address,
  rewardRate,
  rewardType,
  website,
}: {
  [Key in keyof Pick<
    ValidatorDto,
    "stakedBalance" | "votingPower" | "commission" | "address" | "website"
  >]: ValidatorDto[Key] | undefined;
} & {
  stakedBalanceToken: YieldDto["token"] | undefined;
  rewardRate: number | undefined;
  rewardType: RewardTypes | undefined;
}) => {
  const { t } = useTranslation();

  return useMemo<{
    [Key in keyof Pick<
      ValidatorDto,
      "stakedBalance" | "votingPower" | "commission" | "address" | "website"
    >]: { title: string; val: ReactNode } | null;
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
            val: formatAddress(address, { leadingChars: 6, trailingChars: 6 }),
          }
        : null,
      website: website
        ? {
            title: t("details.validators_website"),
            val: <SKAnchor href={website} />,
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
    ]
  );
};
