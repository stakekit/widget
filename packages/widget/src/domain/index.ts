import type {
  ActionDto,
  PendingActionDto,
  TokenDto,
  TransactionDto,
  TransactionStatus,
  YieldDto,
} from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { Left, type Maybe, Right } from "purify-ts";
import { normalizeChainId } from "wagmi";
import type { Override } from "../types/utils";
import type { TokenString } from "./types/tokens";

export { getTokenPriceInUSD } from "./types/price";

export const tokenString = (token: TokenDto): TokenString => {
  return `${token.network}-${token.address?.toLowerCase()}`;
};

export const equalTokens = (a: TokenDto, b: TokenDto) =>
  tokenString(a) === tokenString(b);

export const stakeTokenSameAsGasToken = ({
  stakeToken,
  yieldDto,
}: {
  stakeToken: TokenDto;
  yieldDto: YieldDto;
}) => equalTokens(stakeToken, getGasFeeToken(yieldDto));

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

export const getBaseToken = (yieldDto: YieldDto) => yieldDto.metadata.token;
export const getGasFeeToken = (yieldDto: YieldDto) =>
  yieldDto.metadata.gasFeeToken;

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

export const PAMultiValidatorsRequired = (pa: PendingActionDto) =>
  !!pa.args?.args?.validatorAddresses?.required;

export const PASingleValidatorRequired = (pa: PendingActionDto) =>
  !!pa.args?.args?.validatorAddress?.required;

export const skNormalizeChainId = (chainId: string) => {
  const cId = normalizeChainId(chainId);

  return Number.isNaN(cId) ? (chainId as unknown as number) : cId;
};
