const tokenAmountFormatDefaults: Intl.NumberFormatOptions = {
  maximumFractionDigits: 4,
};

export const formatPercentage = (value: number) =>
  `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;

export const formatTokenAmount = (
  value: number,
  options?: Intl.NumberFormatOptions
) =>
  value.toLocaleString(undefined, {
    ...tokenAmountFormatDefaults,
    ...options,
  });

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
