import type { EarnYieldWithProvider } from "../domain/schema/earn-models";
import { isForceMaxAmount } from "../domain/types/stake";
import { getYieldActionArg } from "../domain/types/yields";

/**
 * Check if we need to use max amount for staking/unstaking
 * based on yields requirements
 */
export const useForceMaxAmount = ({
  type,
  integration,
}: {
  type: "enter" | "exit";
  integration: EarnYieldWithProvider | null;
}) =>
  isForceMaxAmount(
    integration ? getYieldActionArg(integration, type, "amount") : null
  );
