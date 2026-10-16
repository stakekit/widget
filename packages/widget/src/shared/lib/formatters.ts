import type BigNumber from "bignumber.js";
import type { EarnYieldWithProvider } from "../../domain/earn/models";
import { getTokenPriceInUSD } from "../../domain/finance/price";
import { Prices } from "../../domain/health/models";
import type { Token } from "../../domain/token/token";
import { formatTokenAmount, formatUsd } from "./number-format";

export const formatCountryCode = ({
  language,
  countryCode,
}: {
  language: string;
  countryCode: string;
}) => {
  return new Intl.DisplayNames([language], { type: "region" }).of(countryCode);
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
  locale,
  prices,
}: {
  yieldDto: EarnYieldWithProvider | null;
  gas: BigNumber | null;
  locale: string;
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

  return `${formatTokenAmount(gas, locale, "up")} ${
    yieldDto.mechanics.gasFeeToken.symbol
  } ${gasFeeInUSD.isGreaterThan(0) ? ` (${formatUsd(gasFeeInUSD, locale)})` : ""}`;
};

export const getFeesInUSD = ({
  amount,
  locale,
  prices,
  token,
}: {
  amount: BigNumber | null;
  locale: string;
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

  return `${formatTokenAmount(amount, locale, "up")} ${token.symbol} ${
    feeInUSD.isGreaterThan(0) ? ` (${formatUsd(feeInUSD, locale)})` : ""
  }`;
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
