import type {
  ActionDto,
  PendingActionDto,
  TokenDto,
  TransactionDto,
  TransactionStatus,
  TransactionType,
  YieldDto,
} from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { Left, Right } from "purify-ts";
import { normalizeChainId } from "wagmi";
import type { Override } from "../types";
import type { Prices, TokenString } from "./types";

export const tokenString = (token: TokenDto): TokenString => {
  return `${token.network}-${token.address?.toLowerCase()}`;
};

export const equalTokens = (a: TokenDto, b: TokenDto) =>
  tokenString(a) === tokenString(b);

export const getTokenPriceInUSD = ({
  token,
  baseToken,
  amount,
  prices,
  pricePerShare,
}: {
  token: TokenDto;
  baseToken: TokenDto | null;
  amount: string | BigNumber;
  pricePerShare: string | null;
  prices: Prices;
}): BigNumber => {
  const amountBN = BigNumber(amount);

  if (pricePerShare && baseToken) {
    const baseTokenPrice = new BigNumber(
      prices
        .getByToken(baseToken)
        .chainNullable((v) => v.price)
        .orDefault(0)
    );
    const pricePerShareBN = BigNumber(pricePerShare);

    return amountBN.times(baseTokenPrice).times(pricePerShareBN);
  }

  const tokenPrice = new BigNumber(
    prices
      .getByToken(token)
      .chainNullable((v) => v.price)
      .orDefault(0)
  );

  return amountBN.times(tokenPrice);
};

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
  integrationMaxLimit: BigNumber;
}) => {
  return BigNumber.max(
    BigNumber.min(integrationMaxLimit, availableAmount.minus(gasEstimateTotal)),
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

export const transactionsForConstructOnlySet = new Set<TransactionType>([
  "P2P_NODE_REQUEST",
  "LUGANODES_PROVISION",
  "LUGANODES_EXIT_REQUEST",
]);

export const getTransactionsForMultiSign = (txs: TransactionDto[]) =>
  txs.filter((tx) => !transactionsForConstructOnlySet.has(tx.type));

export const skNormalizeChainId = (chainId: string) => {
  const cId = normalizeChainId(chainId);

  return Number.isNaN(cId) ? (chainId as unknown as number) : cId;
};
