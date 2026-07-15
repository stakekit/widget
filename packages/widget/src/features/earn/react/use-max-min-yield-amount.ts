import BigNumber from "bignumber.js";
import { useMemo } from "react";
import { getMaxAmount } from "../../../domain";
import type { EarnYieldWithProvider } from "../../../domain/schema/earn-models";
import type { PositionsData } from "../../../domain/types/positions";
import {
  getMinStakeAmount,
  getMinUnstakeAmount,
} from "../../../domain/types/stake";
import { getYieldActionArg } from "../../../domain/types/yields";
import { useForceMaxAmount } from "./use-force-max-amount";

type Args = {
  yieldOpportunity: EarnYieldWithProvider | null;
  availableAmount: BigNumber | null;
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
          ? new BigNumber(
              type === "enter"
                ? getMinStakeAmount(yieldOpportunity, positionsData)
                : getMinUnstakeAmount(yieldOpportunity, pricePerShare)
            )
          : null,
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
      : (() => {
          const maximum = yieldOpportunity
            ? getYieldActionArg(yieldOpportunity, type, "amount")?.maximum
            : null;
          const amount = maximum == null ? null : new BigNumber(maximum);
          return amount?.isGreaterThan(0) ? amount : null;
        })();
  }, [availableAmount, isForceMax, type, yieldOpportunity]);

  const maxEnterOrExitAmount = useMemo(
    () =>
      getMaxAmount({
        availableAmount: availableAmount ?? new BigNumber(0),
        gasEstimateTotal: new BigNumber(0),
        integrationMaxLimit: maxIntegrationAmount,
      }),
    [maxIntegrationAmount, availableAmount]
  );

  const minEnterOrExitAmount = useMemo(
    () => minIntegrationAmount ?? new BigNumber(0),
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
