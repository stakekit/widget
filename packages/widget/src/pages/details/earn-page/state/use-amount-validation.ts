import type BigNumber from "bignumber.js";
import { useMemo } from "react";

export const useAmountValidation = ({
  availableAmount,
  stakeAmount,
  maxEnterOrExitAmount,
  minEnterOrExitAmount,
}: {
  availableAmount: BigNumber | null;
  stakeAmount: BigNumber;
  minEnterOrExitAmount: BigNumber;
  maxEnterOrExitAmount: BigNumber;
}) => {
  const stakeAmountLessThanMin = useMemo(
    () =>
      availableAmount ? stakeAmount.isLessThan(minEnterOrExitAmount) : false,
    [availableAmount, stakeAmount, minEnterOrExitAmount]
  );

  const stakeAmountGreaterThanMax = useMemo(
    () =>
      availableAmount ? stakeAmount.isGreaterThan(maxEnterOrExitAmount) : false,
    [availableAmount, stakeAmount, maxEnterOrExitAmount]
  );

  const stakeAmountIsZero = useMemo(
    () => (availableAmount ? stakeAmount.isZero() : false),
    [stakeAmount, availableAmount]
  );

  const stakeAmountGreaterThanAvailableAmount = useMemo(
    () =>
      availableAmount ? stakeAmount.isGreaterThan(availableAmount) : false,
    [availableAmount, stakeAmount]
  );

  return {
    stakeAmountLessThanMin,
    stakeAmountGreaterThanMax,
    stakeAmountGreaterThanAvailableAmount,
    stakeAmountIsZero,
  };
};
