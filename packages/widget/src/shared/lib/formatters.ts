import type BigNumber from "bignumber.js";
import type { EarnYieldWithProvider } from "../../domain/earn/models";
import { exactDecimal } from "../../domain/finance/exact";
import { getTokenPriceInUSD } from "../../domain/finance/price";
import { Prices } from "../../domain/health/models";
import type { Token } from "../../domain/token/token";
import { APToPercentage } from "./general";
import { formatNumber } from "./number-format";

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
  rewardRate: BigNumber | number | undefined;
}) => {
  const { rewardRate } = opts;

  if (rewardRate == null || exactDecimal(rewardRate).isZero()) {
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
    gasFeeInUSD.isGreaterThan(0) ? ` (${formatUsd(gasFeeInUSD)})` : ""
  }`;
};

export const getFeesInUSD = ({
  amount,
  prices,
  token,
}: {
  amount: BigNumber | null;
  token: Token | null;
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
    feeInUSD.isGreaterThan(0) ? ` (${formatUsd(feeInUSD)})` : ""
  }`;
};

const usdFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency",
});

const compactUsdFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
  notation: "compact",
  style: "currency",
});

const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 0,
});

const isMissingNumericInput = (
  value: string | BigNumber | number | null | undefined
) => value == null || value === "";

export const formatCompactNumber = (
  value: string | number | null | undefined
) => {
  if (isMissingNumericInput(value)) return "-";

  const amount = exactDecimal(value);

  if (!amount.isFinite()) return "-";

  return compactNumberFormatter.format(amount.toNumber());
};

export const formatUsd = (
  value: string | BigNumber | number | null | undefined
) => {
  if (isMissingNumericInput(value)) return "-";

  const amount = exactDecimal(value);

  if (!amount.isFinite()) return "-";

  if (amount.isZero()) return "$0.00";

  const absoluteAmount = amount.abs();

  if (absoluteAmount.lt(0.01)) {
    return amount.isNegative() ? ">-$0.01" : "<$0.01";
  }

  const formatter = absoluteAmount.lt(1000)
    ? usdFormatter
    : compactUsdFormatter;

  return formatter.format(amount.toNumber());
};

export const formatHealthFactor = (
  value: string | BigNumber | number | null | undefined
) => {
  if (isMissingNumericInput(value)) return "-";

  const amount = exactDecimal(value);

  return amount.isFinite() ? formatNumber(amount, 4) : "-";
};

/** Formats a decimal ratio (e.g. 0.75) as a percent string (e.g. "75%"). */
export const formatPercent = (
  value: string | BigNumber | number | null | undefined
) => {
  if (isMissingNumericInput(value)) return "-";

  const amount = exactDecimal(value);

  return amount.isFinite() ? `${formatNumber(amount.times(100), 2)}%` : "-";
};

export const formatNetworkName = (network: string) =>
  network
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const formatBorrowProviderName = (providerName: string) =>
  providerName.replace(/\s+borrow$/iu, "");

/** Title-cases snake_case / SCREAMING_SNAKE enum-like strings (e.g. "FOO_BAR" → "Foo Bar"). */
export const humanizeEnumValue = (value: string): string =>
  value
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

// Pending action types come straight from the API and can outpace our
// translation maps (e.g. RWA-specific actions like WITHDRAWAL_REQUEST). Use this
// as the i18n `defaultValue`/`defaults` so we never render a raw translation key.
export const humanizePendingActionType = humanizeEnumValue;

export const capitalizeFirstLetters = (text: string): string =>
  text
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
