import BigNumber from "bignumber.js";
import { Result } from "effect";
import type { Override } from "../shared/types/utils";
import type { ActionTransaction, YieldAction } from "./schema/action-models";
import type { EarnYieldWithProvider } from "./schema/earn-models";
import type { AppToken } from "./schema/legacy-models";
import type { TransactionStatus } from "./types/action";
import type { AnyPendingActionDto } from "./types/pending-action";
import {
  isPendingActionValidatorAddressesRequired,
  isPendingActionValidatorAddressRequired,
} from "./types/pending-action";

import { equalTokens } from "./types/tokens";

export const stakeTokenSameAsGasToken = ({
  stakeToken,
  yieldDto,
}: {
  stakeToken: AppToken;
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

export const PAMultiValidatorsRequired = (pa: AnyPendingActionDto) =>
  isPendingActionValidatorAddressesRequired(pa);

export const PASingleValidatorRequired = (pa: AnyPendingActionDto) =>
  isPendingActionValidatorAddressRequired(pa);

export const skNormalizeChainId = (chainId: string) => {
  const cId = Number(chainId);

  return Number.isNaN(cId) ? (chainId as unknown as number) : cId;
};
