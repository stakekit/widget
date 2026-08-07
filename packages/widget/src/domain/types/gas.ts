import type BigNumber from "bignumber.js";
import type { TokenBalance } from "../schema/financial-models";
import { equalTokens } from "./tokens";

type ComparableToken = {
  readonly address?: string;
  readonly network: string;
  readonly symbol: string;
};

type CheckGasAmountIfStake =
  | { isStake: true; stakeToken: ComparableToken; stakeAmount: BigNumber }
  | { isStake: false };

export const checkGasAmount = ({
  gasTokenBalance,
  gasEstimate,
  ...rest
}: {
  gasTokenBalance: TokenBalance | undefined;
  gasEstimate: BigNumber;
} & CheckGasAmountIfStake) => {
  if (!gasTokenBalance) return true;

  const amount =
    rest.isStake && equalTokens(gasTokenBalance.token, rest.stakeToken)
      ? gasTokenBalance.amount.minus(rest.stakeAmount)
      : gasTokenBalance.amount;

  return gasEstimate.isGreaterThan(amount);
};
