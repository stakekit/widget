import type BigNumber from "bignumber.js";
import { exactDecimal } from "./exact";

const minimumFundedUsdValue = 0.01;
const minimumFundedUnitAmount = 0.000001;

/**
 * Whether a wallet balance is worth treating as funded rather than dust.
 * Priced balances need at least $0.01 of value; without a positive price the
 * balance needs at least 0.000001 units.
 */
export const isFundedBalance = ({
  amount,
  priceUsd,
}: {
  readonly amount: string | BigNumber;
  readonly priceUsd: BigNumber | null;
}): boolean => {
  const exactAmount = exactDecimal(amount);
  if (!exactAmount.isGreaterThan(0)) return false;

  return priceUsd?.isGreaterThan(0)
    ? exactAmount.times(priceUsd).isGreaterThanOrEqualTo(minimumFundedUsdValue)
    : exactAmount.isGreaterThanOrEqualTo(minimumFundedUnitAmount);
};
