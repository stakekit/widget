import type { YieldDto } from "@stakekit/api-hooks";
import { APToPercentage, formatNumber } from ".";
import type BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import type { Prices } from "../domain/types";
import { getBaseToken, getTokenPriceInUSD } from "../domain";

export const formatCountryCode = ({
  language,
  countryCode,
}: {
  language: string;
  countryCode: string;
}) => {
  return new Intl.DisplayNames([language], { type: "region" }).of(countryCode);
};

export const getRewardRateFormatted = (
  opts: Pick<YieldDto, "rewardRate" | "rewardType">
) => {
  const { rewardRate, rewardType } = opts;

  if (rewardType === "variable" || !rewardRate) {
    return "- %";
  }

  return `${APToPercentage(rewardRate)}%`;
};

export const getRewardTypeFormatted = (rewardType: YieldDto["rewardType"]) => {
  switch (rewardType) {
    case "apr":
      return "APR";

    case "apy":
      return "APY";

    default:
      return "";
  }
};

export const getGasFeeInUSD = ({
  yieldDto,
  gas,
  prices,
}: {
  yieldDto: Maybe<YieldDto>;
  gas: Maybe<BigNumber>;
  prices: Maybe<Prices>;
}) =>
  Maybe.fromRecord({
    yieldDto,
    gas,
    prices,
  })
    .map((val) => ({
      ...val,
      gasFeeInUSD: getTokenPriceInUSD({
        amount: val.gas.toString(),
        prices: val.prices,
        token: getBaseToken(val.yieldDto.token),
        pricePerShare: undefined,
      }),
    }))
    .mapOrDefault(
      (val) =>
        `${formatNumber(val.gas)} ${val.yieldDto.metadata.gasFeeToken.symbol} ($${formatNumber(val.gasFeeInUSD)})`,
      ""
    );
