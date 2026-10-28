import type BigNumber from "bignumber.js";
import { equalTokens, type Token } from "../token/token";
import type { TokenBalance } from "./models";

type ComparableToken = Pick<Token, "symbol" | "network" | "address">;

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
