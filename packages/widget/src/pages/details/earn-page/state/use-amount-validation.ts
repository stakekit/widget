import type BigNumber from "bignumber.js";
import type { Maybe } from "purify-ts";
import { useMemo } from "react";

export const useAmountValidation = ({
  availableAmount,
  stakeAmount,
  maxEnterOrExitAmount,
  minEnterOrExitAmount,
}: {
  availableAmount: Maybe<BigNumber>;
  stakeAmount: BigNumber;
  minEnterOrExitAmount: BigNumber;
  maxEnterOrExitAmount: BigNumber;
}) => {
  const stakeAmountLessThanMin = useMemo(
    () =>
      availableAmount
        .map(() => stakeAmount.isLessThan(minEnterOrExitAmount))
        .orDefault(false),
    [availableAmount, stakeAmount, minEnterOrExitAmount]
  );

  const stakeAmountGreaterThanMax = useMemo(
    () =>
      availableAmount
        .map(() => stakeAmount.isGreaterThan(maxEnterOrExitAmount))
        .orDefault(false),
    [availableAmount, stakeAmount, maxEnterOrExitAmount]
  );

  const stakeAmountIsZero = useMemo(
    () => availableAmount.map(() => stakeAmount.isZero()).orDefault(false),
    [stakeAmount, availableAmount]
  );

  const stakeAmountGreaterThanAvailableAmount = useMemo(
    () =>
      availableAmount
        .map((val) => stakeAmount.isGreaterThan(val))
        .orDefault(false),
    [availableAmount, stakeAmount]
  );

  return {
    stakeAmountLessThanMin,
    stakeAmountGreaterThanMax,
    stakeAmountGreaterThanAvailableAmount,
    stakeAmountIsZero,
  };
};
