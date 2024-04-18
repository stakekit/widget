import type {
  AddressWithTokenDto,
  TransactionDto,
  useTokenGetTokenBalancesHook,
} from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { EitherAsync, Left, List, Right } from "purify-ts";
import { withRequestErrorRetry } from "./utils";
import { getTransactionsTotalGasAmount } from "../domain";

export const checkGasAmount = ({
  addressWithTokenDto,
  txs,
  tokenGetTokenBalances,
}: {
  addressWithTokenDto: AddressWithTokenDto;
  txs: TransactionDto[];
  tokenGetTokenBalances: ReturnType<typeof useTokenGetTokenBalancesHook>;
}) =>
  withRequestErrorRetry({
    fn: () => tokenGetTokenBalances({ addresses: [addressWithTokenDto] }),
  })
    .mapLeft(() => new GetGasTokenError())
    .chain((res) =>
      EitherAsync.liftEither(
        List.head(res)
          .map((gt) => new BigNumber(gt.amount ?? 0))
          .toEither(new GasTokenMissingError())
      ).chain(async (gasTokenAmount) => {
        const gasEstimate = getTransactionsTotalGasAmount(txs);

        if (gasEstimate.isGreaterThan(gasTokenAmount)) {
          return Left(new NotEnoughGasTokenError());
        }

        return Right(null);
      })
    )
    .chainLeft(async (e) => Right(e));

class NotEnoughGasTokenError extends Error {
  constructor() {
    super("Not enough gas token");
  }
}

class GasTokenMissingError extends Error {
  constructor() {
    super("Gas token missing from response");
  }
}

class GetGasTokenError extends Error {
  constructor() {
    super("Get gas token failed");
  }
}
