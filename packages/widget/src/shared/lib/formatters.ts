import type BigNumber from "bignumber.js";

import { getTokenPriceInUSD } from "../../domain/finance/price";
import { Prices } from "../../domain/finance/prices";
import type { Token } from "../../domain/token/token";
import { formatUsd } from "./number-format";

export const formatCountryCode = ({
  language,
  countryCode,
}: {
  language: string;
  countryCode: string;
}) => new Intl.DisplayNames([language], { type: "region" }).of(countryCode);

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

/** A token amount's USD value, such as "$2.42"; null when its price is unknown. */
export const formatTokenAmountInUSD = ({
  amount,
  locale,
  prices,
  token,
}: {
  amount: BigNumber;
  locale: string;
  prices: Prices | null;
  token: Token;
}): string | null => {
  if (!prices) return null;
  const inUSD = getTokenPriceInUSD({
    amount,
    baseToken: null,
    pricePerShare: null,
    prices,
    token,
  });

  return inUSD.isGreaterThan(0) ? formatUsd(inUSD, locale) : null;
};

export const formatNetworkName = (network: string) =>
  network
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

/**
 * Title-cases snake_case / SCREAMING_SNAKE enum-like strings (e.g. "FOO_BAR" → "Foo Bar").
 * API enums such as pending action types can outpace the translation maps, so
 * this is their i18n `defaultValue`, never a raw translation key.
 */
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

export const capitalizeFirstLetters = (text: string): string =>
  text
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
