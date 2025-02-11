import { shouldForceEnterMinToZero } from "@sk-widget/domain/types";
import type { PositionsData } from "@sk-widget/domain/types/positions";
import type { YieldDto } from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import type { Maybe } from "purify-ts";
import { useMemo } from "react";
import { getMaxAmount } from "../domain";
import { useForceMaxAmount } from "./use-force-max-amount";

type Args = {
  yieldOpportunity: Maybe<YieldDto>;
  availableAmount: Maybe<BigNumber>;
} & (
  | { type: "enter"; positionsData: PositionsData }
  | { type: "exit"; positionsData?: never }
);

export const useMaxMinYieldAmount = ({
  type,
  yieldOpportunity,
  availableAmount,
  positionsData,
}: Args) => {
  const forceMax = useForceMaxAmount({
    type,
    integration: yieldOpportunity,
  });

  const minIntegrationAmount = useMemo(() => {
    return (
      forceMax
        ? availableAmount
        : yieldOpportunity
            .chainNullable((y) => {
              if (
                type === "enter" &&
                shouldForceEnterMinToZero(y.id, positionsData)
              ) {
                return new BigNumber(0);
              }

              return (type === "enter" ? y.args.enter : y.args.exit)?.args
                ?.amount?.minimum;
            })
            .map((a) => new BigNumber(a))
    ).orDefault(new BigNumber(0));
  }, [availableAmount, forceMax, type, yieldOpportunity, positionsData]);

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
