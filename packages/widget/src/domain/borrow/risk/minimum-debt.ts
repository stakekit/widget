import type BigNumber from "bignumber.js";

export const isDebtBelowMarketMinimum = ({
  debt,
  minimum,
}: {
  readonly debt: BigNumber;
  readonly minimum: BigNumber;
}) => debt.gt(0) && minimum.gt(0) && debt.lt(minimum);
