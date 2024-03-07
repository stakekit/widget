import BigNumber from "bignumber.js";
import { Just } from "purify-ts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  dollarFormatter,
  getRewardRateFormatted,
  getRewardTypeFormatted,
} from "../../../utils/formatters";
import { Box } from "../../atoms/box";
import { Text } from "../../atoms/typography";
import { RewardTypes, ValidatorDto } from "@stakekit/api-hooks";
import { APToPercentage, formatAddress, formatNumber } from "../../../utils";

export const useMetaInfo = ({
  commission,
  stakedBalance,
  votingPower,
  address,
  rewardRate,
  rewardType,
}: {
  [Key in keyof Pick<
    ValidatorDto,
    "stakedBalance" | "votingPower" | "commission" | "address"
  >]: ValidatorDto[Key] | undefined;
} & {
  rewardRate: number | undefined;
  rewardType: RewardTypes | undefined;
}) => {
  const { t, i18n } = useTranslation();

  return useMemo<{
    [Key in keyof Pick<
      ValidatorDto,
      "stakedBalance" | "votingPower" | "commission" | "address"
    >]: { title: string; val: string } | null;
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
      stakedBalance: stakedBalance
        ? {
            title: t("details.validators_staked_balance"),
            val: Just(new BigNumber(stakedBalance))
              .filter((v) => !v.isNaN())
              .map((v) => dollarFormatter(i18n.language).format(v.toNumber()))
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
    }),
    [
      address,
      commission,
      i18n.language,
      rewardRate,
      rewardType,
      stakedBalance,
      t,
      votingPower,
    ]
  );
};

export const MetaInfo = ({ title, val }: { title: string; val: string }) => {
  return (
    <Box display="flex" justifyContent="space-between" alignItems="center">
      <Text variant={{ type: "muted" }}>{title}</Text>
      <Text variant={{ type: "muted" }}>{val}</Text>
    </Box>
  );
};
