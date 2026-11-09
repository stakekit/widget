import BigNumber from "bignumber.js";
import "./config";

/**
 * How an amount finer than one base unit becomes a whole base unit: `truncate`
 * drops the excess toward zero; `round` rounds half away from zero.
 */
export type BaseUnitRounding = "round" | "truncate";

const baseUnitRoundingModes = {
  round: BigNumber.ROUND_HALF_UP,
  truncate: BigNumber.ROUND_DOWN,
} as const satisfies Record<BaseUnitRounding, BigNumber.RoundingMode>;

/** A base-unit count in token units of the given decimals. */
export const fromBaseUnits = (amount: bigint, decimals: number): BigNumber =>
  new BigNumber(amount.toString()).shiftedBy(-decimals);

/** A token-unit amount as a whole base-unit count of the given decimals. */
export const toBaseUnits = (
  amount: BigNumber,
  decimals: number,
  rounding: BaseUnitRounding
): bigint =>
  BigInt(
    amount.shiftedBy(decimals).toFixed(0, baseUnitRoundingModes[rounding])
  );
