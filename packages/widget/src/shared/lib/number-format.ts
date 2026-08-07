import BigNumber from "bignumber.js";

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

export const formatNumber = (
  number: string | BigNumber | number,
  decimals?: number
) => {
  const value = BigNumber(number);

  const formatted = (() => {
    if (typeof decimals !== "number") return value;

    const formattedValue = value.decimalPlaces(decimals, BigNumber.ROUND_DOWN);

    return decimals > 0 && !value.isZero() && formattedValue.isZero()
      ? value.precision(decimals, BigNumber.ROUND_DOWN)
      : formattedValue;
  })();
  return formatted.toFormat();
};

export const defaultFormattedNumber = (number: string | BigNumber | number) =>
  formatNumber(number, 6);
