import BigNumber from "bignumber.js";
import type { Prices, TokenString } from "./types";
import type { Token } from "@stakekit/common";
import type {
  ActionDto,
  PendingActionDto,
  TokenDto,
  TransactionDto,
  TransactionStatus,
} from "@stakekit/api-hooks";
import type { Override } from "../types";
import { Left, Right } from "purify-ts";
import { normalizeChainId } from "wagmi";

export const tokenString = (token: TokenDto): TokenString => {
  return `${token.network}-${token.address?.toLowerCase()}`;
};

export const equalTokens = (
  a: Token | TokenDto,
  b: Token | TokenDto
): boolean => {
  return tokenString(a as TokenDto) === tokenString(b as TokenDto);
};

export const getTokenPriceInUSD = ({
  token,
  amount,
  prices,
  pricePerShare,
}: {
  token: Token | TokenDto;
  amount: string | BigNumber;
  pricePerShare: string | undefined;
  prices: Prices;
}): BigNumber => {
  const amountBN = BigNumber(amount);

  const tokenKey = tokenString(token as TokenDto);
  const tokenPrice = prices.get(tokenKey)?.price;

  if (tokenPrice) {
    return amountBN.times(tokenPrice);
  }

  const baseTokenPrice =
    prices.get(tokenString(getBaseToken(token) as TokenDto))?.price ?? 0;
  const pricePerShareBN = BigNumber(pricePerShare ?? 1);

  return amountBN.times(baseTokenPrice).times(pricePerShareBN);
};

export const getMaxAmount = ({
  availableAmount,
  gasEstimateTotal,
  integrationMaxLimit,
}: {
  availableAmount: BigNumber;
  gasEstimateTotal: BigNumber;
  integrationMaxLimit: BigNumber;
}) => {
  return BigNumber.max(
    BigNumber.min(integrationMaxLimit, availableAmount.minus(gasEstimateTotal)),
    new BigNumber(0)
  );
};

export const getBaseToken = (token: Token | TokenDto) => {
  const { address, ...restToken } = token;

  return restToken as Token;
};

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

export const getTransactionsTotalGasAmount = (txs: TransactionDto[]) =>
  txs.reduce(
    (acc, val) => acc.plus(new BigNumber(val.gasEstimate?.amount ?? 0)),
    new BigNumber(0)
  );

export const getTransactionsForMultiSign = (txs: TransactionDto[]) =>
  txs.filter((tx) => tx.type !== "P2P_NODE_REQUEST");

export const skNormalizeChainId = (chainId: string) => {
  const cId = normalizeChainId(chainId);

  return isNaN(cId) ? (chainId as unknown as number) : cId;
};
