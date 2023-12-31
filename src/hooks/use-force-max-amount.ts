import { YieldDto } from "@stakekit/api-hooks";
import { Maybe } from "purify-ts";

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
    .map((val) => val.minimum === -1 && val.maximum === -1)
    .orDefault(false);
