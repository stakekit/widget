import BigNumber from "bignumber.js";
import { Prices, TokenString } from "./types";
import { Token } from "@stakekit/common";
import {
  ActionDto,
  TokenDto,
  TransactionDto,
  TransactionStatusResponseDto,
} from "@stakekit/api-hooks";
import { Override } from "../types";
import { Left, Right } from "purify-ts";
import {
  SupportedEvmChain,
  SupportedSKChains,
  supportedEVMChainsSet,
} from "./types/chains";

export const isEVMNetwork = (network: SupportedSKChains) =>
  supportedEVMChainsSet.has(network as SupportedEvmChain);

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
  const ts = tokenString(token as TokenDto);
  const price = prices.get(ts)?.price ?? 0;
  const pricePerShareBN = BigNumber(pricePerShare ?? 1);

  return amountBN.times(price).times(pricePerShareBN);
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

  return val.transactions.some((tx) => isTxError(tx))
    ? Left(new Error("Transaction failed"))
    : Right(val);
};

export const isTxError = (tx: TransactionDto | TransactionStatusResponseDto) =>
  tx.status === "FAILED" || tx.status === "BLOCKED";
