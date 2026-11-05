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

/** The formatted gas fee with its USD value; null when no estimate settled. */
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
}): string | null => {
  if (!yieldDto || !gas) return null;

  const gasFeeInUSD = getTokenPriceInUSD({
    amount: gas,
    prices: prices ?? new Prices(new Map()),
    token: yieldDto.mechanics.gasFeeToken,
    pricePerShare: null,
    baseToken: null,
  });

  const fee = `${formatTokenAmount(gas, locale, "up")} ${yieldDto.mechanics.gasFeeToken.symbol}`;

  return gasFeeInUSD.isGreaterThan(0)
    ? `${fee} (${formatUsd(gasFeeInUSD, locale)})`
    : fee;
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

  const fee = `${formatTokenAmount(amount, locale, "up")} ${token.symbol}`;

  return feeInUSD.isGreaterThan(0)
    ? `${fee} (${formatUsd(feeInUSD, locale)})`
    : fee;
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

/** Sentence-cases snake_case / SCREAMING_SNAKE enum-like strings (e.g. "SET_OPERATOR" → "Set operator"). */
export const sentenceCaseEnumValue = (value: string): string => {
  const words = value.split("_").filter(Boolean).join(" ").toLowerCase();

  return words.charAt(0).toUpperCase() + words.slice(1);
};

// Pending action types come straight from the API and can outpace our
// translation maps (e.g. RWA-specific actions like WITHDRAWAL_REQUEST). Use this
// as the i18n `defaultValue`/`defaults` so we never render a raw translation key.
export const humanizePendingActionType = humanizeEnumValue;

export const capitalizeFirstLetters = (text: string): string =>
  text
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
