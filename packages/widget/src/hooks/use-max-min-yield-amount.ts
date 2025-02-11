import type { PositionsData } from "@sk-widget/domain/types/positions";
import { getMinStakeAmount } from "@sk-widget/domain/types/stake";
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
                : y.args.exit?.args?.amount?.minimum
            )
            .map((a) => new BigNumber(a)),
    [availableAmount, isForceMax, type, yieldOpportunity, positionsData]
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
