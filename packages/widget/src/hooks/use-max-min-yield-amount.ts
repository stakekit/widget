import type { YieldDto } from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import type { Maybe } from "purify-ts";
import { useMemo } from "react";
import { getMaxAmount } from "../domain";
import { useForceMaxAmount } from "./use-force-max-amount";

export const useMaxMinYieldAmount = ({
  type,
  yieldOpportunity,
  availableAmount,
}: {
  yieldOpportunity: Maybe<YieldDto>;
  availableAmount: Maybe<BigNumber>;
  type: "enter" | "exit";
}) => {
  const forceMax = useForceMaxAmount({
    type,
    integration: yieldOpportunity,
  });

  const minIntegrationAmount = useMemo(() => {
    return (
      forceMax
        ? availableAmount
        : yieldOpportunity
            .chainNullable(
              (y) =>
                (type === "enter" ? y.args.enter : y.args.exit)?.args?.amount
                  ?.minimum
            )
            .map((a) => new BigNumber(a))
    ).orDefault(new BigNumber(0));
  }, [availableAmount, forceMax, type, yieldOpportunity]);

  const maxIntegrationAmount = useMemo(() => {
    return (
      forceMax
        ? availableAmount
        : yieldOpportunity
            .chainNullable(
              (y) =>
                (type === "enter" ? y.args.enter : y.args.exit)?.args?.amount
                  ?.maximum
            )
            .map((a) => new BigNumber(a))
    ).orDefault(new BigNumber(Number.POSITIVE_INFINITY));
  }, [availableAmount, forceMax, type, yieldOpportunity]);

  const maxEnterOrExitAmount = useMemo(
    () =>
      getMaxAmount({
        availableAmount: availableAmount.orDefault(new BigNumber(0)),
        gasEstimateTotal: new BigNumber(0),
        integrationMaxLimit: maxIntegrationAmount,
      }),
    [maxIntegrationAmount, availableAmount]
  );

  const minEnterOrExitAmount = minIntegrationAmount;

  return useMemo(
    () => ({
      minEnterOrExitAmount,
      maxEnterOrExitAmount,
      maxIntegrationAmount,
    }),
    [maxEnterOrExitAmount, minEnterOrExitAmount, maxIntegrationAmount]
  );
};
