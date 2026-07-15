const tokenAmountFormatDefaults: Intl.NumberFormatOptions = {
  maximumFractionDigits: 4,
};

export const roundFormattedTokenAmount = (
  value: number,
  options?: Intl.NumberFormatOptions
) =>
  Number(
    new Intl.NumberFormat("en-US", {
      useGrouping: false,
      ...tokenAmountFormatDefaults,
      ...options,
    }).format(value)
  );

export const formatUsdAmount = (value: number) =>
  `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
