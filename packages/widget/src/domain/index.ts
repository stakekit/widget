import BigNumber from "bignumber.js";
import { Result } from "effect";

type Override<T1, T2> = Omit<T1, keyof T2> & T2;

import type {
  ActionTransaction,
  PendingAction,
  YieldAction,
} from "./action/models";
import {
  isPendingActionValidatorAddressesRequired,
  isPendingActionValidatorAddressRequired,
} from "./action/pending-action";
import type { TransactionStatus } from "./action/rules";
import type { EarnYieldWithProvider } from "./earn/models";
import type { Token } from "./token/token";
import { equalTokens } from "./token/token";

export const stakeTokenSameAsGasToken = ({
  stakeToken,
  yieldDto,
}: {
  stakeToken: Token;
  yieldDto: EarnYieldWithProvider;
}) => equalTokens(stakeToken, yieldDto.mechanics.gasFeeToken);

export const getMaxAmount = ({
  availableAmount,
  gasEstimateTotal,
  integrationMaxLimit,
}: {
  availableAmount: BigNumber;
  gasEstimateTotal: BigNumber;
  integrationMaxLimit: BigNumber | null;
}) => {
  return BigNumber.max(
    BigNumber.min(
      integrationMaxLimit ?? BigNumber(Number.POSITIVE_INFINITY),
      availableAmount.minus(gasEstimateTotal)
    ),
    new BigNumber(0)
  );
};

/**
 *
 * @summary Get stake transactions available for signing or tx status check.
 * If any of the transactions are in a failed state, return an error
 */
export const getValidStakeSessionTx = (stakeDto: YieldAction) => {
  const val: YieldAction = {
    ...stakeDto,
    transactions: stakeDto.transactions.filter(
      (
        tx
      ): tx is Override<
        ActionTransaction,
        {
          status: Override<
            ActionTransaction["status"],
            Exclude<ActionTransaction["status"], "SKIPPED">
          >;
        }
      > => tx.status !== "SKIPPED"
    ),
  };

  return val.transactions.some((tx) => isTxError(tx.status))
    ? Result.fail(new Error("Transaction failed"))
    : Result.succeed(val);
};

export const isTxError = (txStatus: TransactionStatus) =>
  txStatus === "FAILED" || txStatus === "BLOCKED";

export const PAMultiValidatorsRequired = (pa: PendingAction) =>
  isPendingActionValidatorAddressesRequired(pa);

export const PASingleValidatorRequired = (pa: PendingAction) =>
  isPendingActionValidatorAddressRequired(pa);

export const skNormalizeChainId = (chainId: string) => {
  const cId = Number(chainId);

  return Number.isNaN(cId) ? (chainId as unknown as number) : cId;
};
