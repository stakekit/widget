import type BigNumber from "bignumber.js";

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
  readonly amount: BigNumber;
  readonly priceUsd: BigNumber | null;
}): boolean => {
  if (!amount.isGreaterThan(0)) return false;

  return priceUsd?.isGreaterThan(0)
    ? amount.times(priceUsd).isGreaterThanOrEqualTo(minimumFundedUsdValue)
    : amount.isGreaterThanOrEqualTo(minimumFundedUnitAmount);
};
