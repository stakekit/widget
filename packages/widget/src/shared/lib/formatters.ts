import BigNumber from "bignumber.js";
import type { EarnYieldWithProvider } from "../../domain/schema/earn-models";
import { Prices } from "../../domain/schema/health-price-models";
import type { AppToken } from "../../domain/schema/legacy-models";
import { getTokenPriceInUSD } from "../../domain/types/price";
import { APToPercentage } from "./general";
import { defaultFormattedNumber, formatNumber } from "./number-format";

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
  yieldDto: EarnYieldWithProvider | null;
  gas: BigNumber | null;
  prices: Prices | null;
}) => {
  if (!yieldDto || !gas) return "";

  const gasFeeInUSD = getTokenPriceInUSD({
    amount: gas.toString(),
    prices: prices ?? new Prices(new Map()),
    token: yieldDto.mechanics.gasFeeToken,
    pricePerShare: null,
    baseToken: null,
  });

  return `${formatNumber(gas, 10)} ${yieldDto.mechanics.gasFeeToken.symbol} ${
    gasFeeInUSD.isGreaterThan(0)
      ? ` ($${defaultFormattedNumber(gasFeeInUSD)})`
      : ""
  }`;
};

export const getFeesInUSD = ({
  amount,
  prices,
  token,
}: {
  amount: BigNumber | null;
  token: AppToken | null;
  prices: Prices | null;
}) => {
  if (!token || !amount) return "";

  const feeInUSD = getTokenPriceInUSD({
    amount,
    prices: prices ?? new Prices(new Map()),
    token,
    pricePerShare: null,
    baseToken: null,
  });

  return `${formatNumber(amount, 10)} ${token.symbol} ${
    feeInUSD.isGreaterThan(0) ? ` ($${defaultFormattedNumber(feeInUSD)})` : ""
  }`;
};

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
  text
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
