import {
  AddressWithTokenDto,
  TransactionDto,
  tokenGetTokenBalances,
} from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { EitherAsync, Left, List, Right } from "purify-ts";
import { withRequestErrorRetry } from "./utils";
import { getTransactionTotalGas } from "../domain";

export const checkGasAmount = ({
  addressWithTokenDto,
  transactionConstructRes,
}: {
  addressWithTokenDto: AddressWithTokenDto;
  transactionConstructRes: TransactionDto[];
}) =>
  withRequestErrorRetry({
    fn: () =>
      tokenGetTokenBalances({
        addresses: [addressWithTokenDto],
      }),
  })
    .mapLeft(() => new GetGasTokenError())
    .chain((res) =>
      EitherAsync.liftEither(
        List.head(res)
          .map((gt) => new BigNumber(gt.amount ?? 0))
          .toEither(new GasTokenMissingError())
      ).chain(async (gasTokenAmount) => {
        const gasEstimate = getTransactionTotalGas(transactionConstructRes);

        if (gasEstimate.isGreaterThan(gasTokenAmount)) {
          return Left(new NotEnoughGasTokenError());
        }

        return Right(undefined);
      })
    );

export class NotEnoughGasTokenError extends Error {
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
