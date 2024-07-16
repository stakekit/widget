import type { YieldDto } from "@stakekit/api-hooks";
import type BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import { APToPercentage, defaultFormattedNumber } from ".";
import { getTokenPriceInUSD } from "../domain";
import { Prices } from "../domain/types";

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
  opts: Pick<YieldDto, "rewardType"> & { rewardRate: number | undefined }
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
  })
    .map((val) => ({
      ...val,
      gasFeeInUSD: getTokenPriceInUSD({
        amount: val.gas.toString(),
        prices: prices.orDefault(new Prices(new Map())),
        token: val.yieldDto.metadata.gasFeeToken,
        pricePerShare: null,
        baseToken: null,
      }),
    }))
    .mapOrDefault(
      (val) =>
        `${defaultFormattedNumber(val.gas)} ${val.yieldDto.metadata.gasFeeToken.symbol} ${
          val.gasFeeInUSD.isGreaterThan(0)
            ? ` ($${defaultFormattedNumber(val.gasFeeInUSD)})`
            : ""
        }`,
      ""
    );
