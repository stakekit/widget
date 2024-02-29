import { Networks } from "@stakekit/common";
import BigNumber from "bignumber.js";
import { MaybeWindow } from "./maybe-window";

BigNumber.config({
  FORMAT: {
    prefix: "",
    decimalSeparator: ".",
    groupSeparator: ",",
    groupSize: 3,
    secondaryGroupSize: 0,
    fractionGroupSeparator: " ",
    fractionGroupSize: 0,
    suffix: "",
  },
});

const defaultDecimalPlaces = 10;

export const formatNumber = (
  number: string | BigNumber,
  decimals = defaultDecimalPlaces
) => {
  return BigNumber(number)
    .decimalPlaces(decimals, BigNumber.ROUND_UP)
    .toFormat();
};

export const APToPercentage = (ap: number) => {
  return (ap * 100).toFixed(2);
};

const colorsTuple = ["#6B69D6", "#F1C40F", "#1ABC9C", "#E74C3C"];

export const getBackgroundColor = (stringInput: string) => {
  const char = stringInput.charCodeAt(0);

  return colorsTuple[char % colorsTuple.length] ?? colorsTuple[0];
};

export const isLedgerDappBrowserProvider = (() => {
  let state: boolean | null = null;

  return (): boolean => {
    if (typeof state === "boolean") return state;

    return MaybeWindow.map((w) => {
      try {
        const params = new URLSearchParams(w.self.location.search);

        state = !!params.get("embed");
      } catch (error) {
        state = false;
      } finally {
        return !!state;
      }
    }).orDefault(false);
  };
})();

export const getNetworkLogo = (network: Networks) =>
  `https://assets.stakek.it/networks/${network}.svg`;

export const getTokenLogo = (tokenName: string) =>
  `https://assets.stakek.it/tokens/${tokenName}.svg`;

export const getSKIcon = (iconName: string) =>
  `https://assets.stakek.it/stakekit/${iconName}`;

export const waitForMs = (ms: number) =>
  new Promise((res) => setTimeout(res, ms));

export const typeSafeObjectFromEntries = <
  const T extends ReadonlyArray<readonly [PropertyKey, unknown]>,
>(
  entries: T
): { [K in T[number] as K[0]]: K[1] } => {
  return Object.fromEntries(entries) as { [K in T[number] as K[0]]: K[1] };
};

export const typeSafeObjectEntries = <T extends Record<PropertyKey, unknown>>(
  obj: T
): { [K in keyof T]: [K, T[K]] }[keyof T][] => {
  return Object.entries(obj) as { [K in keyof T]: [K, T[K]] }[keyof T][];
};

export function formatAddress(
  address: string,
  opts?: { leadingChars: number; trailingChars: number }
): string {
  const leadingChars = opts?.leadingChars ?? 4;
  const trailingChars = opts?.trailingChars ?? 4;

  return address.length < leadingChars + trailingChars
    ? address
    : `${address.substring(0, leadingChars)}\u2026${address.substring(
        address.length - trailingChars
      )}`;
}
