import BigNumber from "bignumber.js";
import { Prices, TokenString } from "./types";
import { EvmNetworks, Token } from "@stakekit/common";
import {
  StakeDto,
  TransactionDto,
  TransactionStatusResponseDto,
} from "@stakekit/api-hooks";
import { Override } from "../types";
import { Left, Right } from "purify-ts";
import { Chain } from "wagmi";
import { cosmosWagmiChains } from "../providers/cosmos/config";

export const evmNetworksSet = new Set(Object.values(EvmNetworks));

export const isEvmNetwork = (network: string): network is EvmNetworks =>
  evmNetworksSet.has(network.toLowerCase() as EvmNetworks);

export const isCosmosChain = (chain: Chain) =>
  cosmosWagmiChains.some((c) => c.id === chain.id);

export const tokenString = (token: Token): TokenString => {
  return `${token.network}-${token.address?.toLowerCase()}`;
};

export const equalTokens = (a: Token, b: Token): boolean => {
  return tokenString(a) === tokenString(b);
};

export const getTokenPriceInUSD = ({
  token,
  amount,
  prices,
}: {
  token: Token;
  amount: string | BigNumber;
  prices: Prices;
}): BigNumber => {
  const amountBN = BigNumber(amount);
  const ts = tokenString(token);
  const price = prices.get(ts)?.price ?? 0;

  return amountBN.times(price);
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

export const getBaseToken = (token: Token) => {
  const { address, ...restToken } = token;

  return restToken as Token;
};

/**
 * Get stake transactions available for signing or tx status check
 * If any of the transactions are in a failed state, return an error
 */
export const getValidStakeSessionTx = (stakeDto: StakeDto) => {
  const val: StakeDto = {
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
