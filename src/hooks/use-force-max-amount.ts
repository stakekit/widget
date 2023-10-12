import { YieldDto } from "@stakekit/api-hooks";
import { Maybe } from "purify-ts";
import { useYieldBalance } from "./use-yield-balance";
import { useMemo } from "react";

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
}) => {
  const yieldBalance = useYieldBalance(integration);

  const forceMax = useMemo(
    () =>
      integration
        .chainNullable((v) =>
          type === "enter"
            ? v.args.enter.args?.amount
            : v.args.exit?.args?.amount
        )
        .map((val) => val.minimum === -1 && val.maximum === -1)
        .orDefault(false),
    [integration, type]
  );

  const canStake =
    type === "enter" && (!forceMax || !yieldBalance.data?.length);

  return {
    isLoading: yieldBalance.isLoading,
    data: {
      forceMax,
      canStake,
    },
  };
};
