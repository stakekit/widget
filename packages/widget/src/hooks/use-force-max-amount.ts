import type { YieldDto } from "@stakekit/api-hooks";
import type { Maybe } from "purify-ts";
import { isForceMaxAmount } from "../domain/types/stake";

/**
 * Check if we need to use max amount for staking/unstaking
 * based on yields requirements
 */
export const useForceMaxAmount = ({
  type,
  integration,
}: {
  type: "enter" | "exit";
  integration: Maybe<YieldDto>;
}) =>
  integration
    .chainNullable((v) =>
      type === "enter" ? v.args.enter.args?.amount : v.args.exit?.args?.amount
    )
    .map(isForceMaxAmount)
    .orDefault(false);
