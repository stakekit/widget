import BigNumber from "bignumber.js";
import { Left, type Maybe, Right } from "purify-ts";
import type { Override } from "../types/utils";
import type {
  ActionDto,
  TransactionDto,
  TransactionStatus,
} from "./types/action";
import type { AnyPendingActionDto } from "./types/pending-action";
import {
  isPendingActionValidatorAddressesRequired,
  isPendingActionValidatorAddressRequired,
} from "./types/pending-action";
import type { TokenDto, TokenString } from "./types/tokens";
import type { Yield } from "./types/yields";

export { getTokenPriceInUSD } from "./types/price";

type TokenLike = Pick<TokenDto, "symbol"> & {
  network: string;
  address?: string;
};

export const tokenString = (token: TokenLike): TokenString => {
  return `${token.network}-${token.address?.toLowerCase() ?? ""}` as TokenString;
};

export const equalTokens = (a: TokenLike, b: TokenLike) =>
  tokenString(a) === tokenString(b) && a.symbol === b.symbol;

export const stakeTokenSameAsGasToken = ({
  stakeToken,
  yieldDto,
}: {
  stakeToken: TokenDto;
  yieldDto: Yield;
}) => equalTokens(stakeToken, yieldDto.mechanics.gasFeeToken);

export const getMaxAmount = ({
  availableAmount,
  gasEstimateTotal,
  integrationMaxLimit,
}: {
  availableAmount: BigNumber;
  gasEstimateTotal: BigNumber;
  integrationMaxLimit: Maybe<BigNumber>;
}) => {
  return BigNumber.max(
    BigNumber.min(
      integrationMaxLimit.orDefault(BigNumber(Number.POSITIVE_INFINITY)),
      availableAmount.minus(gasEstimateTotal)
    ),
    new BigNumber(0)
  );
};

export const getBaseToken = (yieldDto: Yield) => yieldDto.token;

/**
 *
 * @summary Get stake transactions available for signing or tx status check.
 * If any of the transactions are in a failed state, return an error
 */
export const getValidStakeSessionTx = (stakeDto: ActionDto) => {
  const val: ActionDto = {
    ...stakeDto,
    transactions: stakeDto.transactions.filter(
      (
        tx
      ): tx is Override<
        TransactionDto,
        {
          status: Override<
            TransactionDto["status"],
            Exclude<TransactionDto["status"], "SKIPPED">
          >;
        }
      > => tx.status !== "SKIPPED"
    ),
  };

  return val.transactions.some((tx) => isTxError(tx.status))
    ? Left(new Error("Transaction failed"))
    : Right(val);
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
