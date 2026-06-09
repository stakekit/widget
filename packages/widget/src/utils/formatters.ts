import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import { getTokenPriceInUSD } from "../domain";
import { Prices } from "../domain/types/price";
import type { TokenDto, YieldTokenDto } from "../domain/types/tokens";
import type { Yield } from "../domain/types/yields";
import { APToPercentage, defaultFormattedNumber, formatNumber } from ".";

export const formatCountryCode = ({
  language,
  countryCode,
}: {
  language: string;
  countryCode: string;
}) => {
  return new Intl.DisplayNames([language], { type: "region" }).of(countryCode);
};

export const getRewardRateFormatted = (opts: {
  rewardRate: number | undefined;
}) => {
  const { rewardRate } = opts;

  if (!rewardRate) {
    return "- %";
  }

  return `${APToPercentage(rewardRate)}%`;
};

export const getRewardTypeFormatted = (rewardType: string | undefined) => {
  switch (rewardType?.toLowerCase()) {
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
  yieldDto: Maybe<Yield>;
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
        token: val.yieldDto.mechanics.gasFeeToken,
        pricePerShare: null,
        baseToken: null,
      }),
    }))
    .mapOrDefault(
      (val) =>
        `${formatNumber(val.gas, 10)} ${val.yieldDto.mechanics.gasFeeToken.symbol} ${
          val.gasFeeInUSD.isGreaterThan(0)
            ? ` ($${defaultFormattedNumber(val.gasFeeInUSD)})`
            : ""
        }`,
      ""
    );

export const getFeesInUSD = ({
  amount,
  prices,
  token,
}: {
  amount: Maybe<BigNumber>;
  token: Maybe<TokenDto | YieldTokenDto>;
  prices: Maybe<Prices>;
}) =>
  Maybe.fromRecord({ token, amount })
    .map((val) => ({
      ...val,
      feeInUSD: getTokenPriceInUSD({
        amount: val.amount,
        prices: prices.orDefault(new Prices(new Map())),
        token: val.token,
        pricePerShare: null,
        baseToken: null,
      }),
    }))
    .mapOrDefault(
      (val) =>
        `${formatNumber(val.amount, 10)} ${val.token.symbol} ${
          val.feeInUSD.isGreaterThan(0)
            ? ` ($${defaultFormattedNumber(val.feeInUSD)})`
            : ""
        }`,
      ""
    );

const compactUsdFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 0,
});

const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 0,
});

export const formatCompactNumber = (
  value: string | number | null | undefined
) => {
  if (value == null || value === "") return "-";

  const amount = BigNumber(value);

  if (!amount.isFinite()) return "-";

  return compactNumberFormatter.format(amount.toNumber());
};

export const formatCompactUsd = (value: string | number | null | undefined) => {
  if (value == null || value === "") return "-";

  const amount = BigNumber(value);

  if (!amount.isFinite()) return "-";

  return `$${compactUsdFormatter.format(amount.toNumber())}`;
};

// Pending action types come straight from the API and can outpace our
// translation maps (e.g. RWA-specific actions like WITHDRAWAL_REQUEST). Use this
// as the i18n `defaultValue`/`defaults` so we never render a raw translation key.
export const humanizePendingActionType = (type: string): string =>
  type
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

export const capitalizeFirstLetters = (text: string): string =>
  Maybe.fromNullable(text)
    .map((t) =>
      t
        .split(" ")
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(" ")
    )
    .orDefault("");
