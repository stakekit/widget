import type { YieldDto } from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import type { Maybe } from "purify-ts";
import { useMemo } from "react";
import { getMaxAmount } from "../domain";
import type { PositionsData } from "../domain/types/positions";
import { getMinStakeAmount, getMinUnstakeAmount } from "../domain/types/stake";
import { useForceMaxAmount } from "./use-force-max-amount";

type Args = {
  yieldOpportunity: Maybe<YieldDto>;
  availableAmount: Maybe<BigNumber>;
} & (
  | { type: "enter"; positionsData: PositionsData; pricePerShare?: never }
  | { type: "exit"; positionsData?: never; pricePerShare: string | null }
);

export const useMaxMinYieldAmount = ({
  type,
  yieldOpportunity,
  availableAmount,
  positionsData,
  pricePerShare,
}: Args) => {
  const isForceMax = useForceMaxAmount({
    type,
    integration: yieldOpportunity,
  });

  const minIntegrationAmount = useMemo(
    () =>
      isForceMax
        ? availableAmount
        : yieldOpportunity
            .chainNullable((y) =>
              type === "enter"
                ? getMinStakeAmount(y, positionsData)
                : getMinUnstakeAmount(y, pricePerShare)
            )
            .map((a) => new BigNumber(a)),
    [
      availableAmount,
      isForceMax,
      type,
      yieldOpportunity,
      positionsData,
      pricePerShare,
    ]
  );

  const maxIntegrationAmount = useMemo(() => {
    return isForceMax
      ? availableAmount
      : yieldOpportunity
          .chainNullable(
            (y) =>
              (type === "enter" ? y.args.enter : y.args.exit)?.args?.amount
                ?.maximum
          )
          .map((a) => new BigNumber(a));
  }, [availableAmount, isForceMax, type, yieldOpportunity]);

  const maxEnterOrExitAmount = useMemo(
    () =>
      getMaxAmount({
        availableAmount: availableAmount.orDefault(new BigNumber(0)),
        gasEstimateTotal: new BigNumber(0),
        integrationMaxLimit: maxIntegrationAmount,
      }),
    [maxIntegrationAmount, availableAmount]
  );

  const minEnterOrExitAmount = useMemo(
    () => minIntegrationAmount.orDefault(new BigNumber(0)),
    [minIntegrationAmount]
  );

  return useMemo(
    () => ({
      minIntegrationAmount,
      maxIntegrationAmount,

      minEnterOrExitAmount,
      maxEnterOrExitAmount,

      isForceMax,
    }),
    [
      minIntegrationAmount,
      maxEnterOrExitAmount,
      minEnterOrExitAmount,
      maxIntegrationAmount,
      isForceMax,
    ]
  );
};
