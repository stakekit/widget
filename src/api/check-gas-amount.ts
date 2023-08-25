import {
  AddressWithTokenDto,
  TransactionDto,
  tokenGetTokenBalances,
} from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { EitherAsync, Left, List, Right } from "purify-ts";

export const checkGasAmount = ({
  addressWithTokenDto,
  transactionConstructRes,
}: {
  addressWithTokenDto: AddressWithTokenDto;
  transactionConstructRes: TransactionDto[];
}) =>
  EitherAsync(() =>
    tokenGetTokenBalances({
      addresses: [addressWithTokenDto],
    })
  )
    .mapLeft(() => new GetGasTokenError())
    .chain((res) =>
      EitherAsync.liftEither(
        List.head(res)
          .map((gt) => new BigNumber(gt.amount ?? 0))
          .toEither(new GasTokenMissingError())
      ).chain(async (gasTokenAmount) => {
        const gasEstimate = transactionConstructRes.reduce(
          (acc, next) => acc.plus(new BigNumber(next.gasEstimate?.amount ?? 0)),
          new BigNumber(0)
        );

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

export class GasTokenMissingError extends Error {
  constructor() {
    super("Gas token missing from response");
  }
}

export class GetGasTokenError extends Error {
  constructor() {
    super("Get gas token failed");
  }
}
