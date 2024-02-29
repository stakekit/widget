import BigNumber from "bignumber.js";
import { Just } from "purify-ts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { dollarFormatter } from "../../../utils/formatters";
import { Box } from "../../atoms/box";
import { Text } from "../../atoms/typography";
import { ValidatorDto } from "@stakekit/api-hooks";
import { APToPercentage, formatAddress, formatNumber } from "../../../utils";

export const ValidatorStakedBalance = ({
  stakedBalance,
}: Pick<ValidatorDto, "stakedBalance">) => {
  const { t, i18n } = useTranslation();

  const val = useMemo(
    () =>
      Just(new BigNumber(stakedBalance))
        .filter((v) => !v.isNaN())
        .map((v) => dollarFormatter(i18n.language).format(v.toNumber()))
        .orDefault("-"),
    [i18n.language, stakedBalance]
  );

  return <MetaInfo title={t("details.validators_staked_balance")} val={val} />;
};

export const ValidatorVotingPower = ({
  votingPower,
}: Pick<ValidatorDto, "votingPower">) => {
  const { t } = useTranslation();

  const val = useMemo(
    () =>
      Just(new BigNumber(votingPower))
        .filter((v) => !v.isNaN())
        .map((v) => `${APToPercentage(v.toNumber())}%`)
        .orDefault("-"),
    [votingPower]
  );

  return <MetaInfo title={t("details.validators_voting_power")} val={val} />;
};

export const ValidatorComission = ({
  comisssion,
}: {
  comisssion: ValidatorDto["commission"];
}) => {
  const { t } = useTranslation();

  const val = useMemo(
    () =>
      Just(new BigNumber(comisssion))
        .filter((v) => !v.isNaN())
        .map((v) => `${formatNumber(APToPercentage(v.toNumber()))}%`)
        .orDefault("-"),
    [comisssion]
  );

  return <MetaInfo title={t("details.validators_comission")} val={val} />;
};

export const ValidatorAddress = ({
  address,
}: {
  address: ValidatorDto["address"];
}) => {
  const { t } = useTranslation();

  const val = useMemo(
    () => formatAddress(address, { leadingChars: 6, trailingChars: 6 }),
    [address]
  );

  return <MetaInfo title={t("details.validators_address")} val={val} />;
};

const MetaInfo = ({ title, val }: { title: string; val: string }) => {
  return (
    <Box display="flex" justifyContent="space-between" alignItems="center">
      <Text variant={{ type: "muted" }}>{title}</Text>
      <Text variant={{ type: "muted" }}>{val}</Text>
    </Box>
  );
};
