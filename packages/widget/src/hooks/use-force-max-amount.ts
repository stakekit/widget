import type { Maybe } from "purify-ts";
import { isForceMaxAmount } from "../domain/types/stake";
import { getYieldActionArg, type Yield } from "../domain/types/yields";

/**
 * Check if we need to use max amount for staking/unstaking
 * based on yields requirements
 */
export const useForceMaxAmount = ({
  type,
  integration,
}: {
  type: "enter" | "exit";
  integration: Maybe<Yield>;
}) =>
  integration
    .chainNullable((v) => getYieldActionArg(v, type, "amount"))
    .map(isForceMaxAmount)
    .orDefault(false);
