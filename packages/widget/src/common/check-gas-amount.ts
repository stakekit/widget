import BigNumber from "bignumber.js";
import { EitherAsync, Left, List, Maybe, Right } from "purify-ts";
import { equalTokens } from "../domain";
import type { ActionDtoWithGasEstimate } from "../domain/types/action";
import type { AddressWithTokenDto } from "../domain/types/addresses";
import type { TokenDto } from "../domain/types/tokens";
import { tokenGetTokenBalances } from "./private-api";

type CheckGasAmountIfStake =
  | { isStake: true; stakeToken: TokenDto; stakeAmount: BigNumber }
  | { isStake: false };

export const checkGasAmount = ({
  addressWithTokenDto,
  gasEstimate,
  ...rest
}: {
  addressWithTokenDto: AddressWithTokenDto;
  gasEstimate: ActionDtoWithGasEstimate["gasEstimate"];
} & CheckGasAmountIfStake) =>
  EitherAsync.liftEither(
    Maybe.fromNullable(gasEstimate).toEither(new GasTokenMissingError())
  ).chain((gasEstimate) =>
    EitherAsync(() =>
      tokenGetTokenBalances({ addresses: [addressWithTokenDto] })
    )
      .mapLeft(() => new GetGasTokenError())
      .chain((res) =>
        EitherAsync.liftEither(
          List.head(res)
            .map((val) => ({
              ...val,
              amount: new BigNumber(val.amount ?? 0),
            }))
            .toEither(new GasTokenMissingError())
        ).chain(async (gasTokenBalance) => {
          const amount =
            rest.isStake && equalTokens(gasTokenBalance.token, rest.stakeToken)
              ? gasTokenBalance.amount.minus(rest.stakeAmount)
              : gasTokenBalance.amount;

          if (gasEstimate.amount.isGreaterThan(amount)) {
            return Left(new NotEnoughGasTokenError());
          }

          return Right(null);
        })
      )
      .chainLeft(async (e) => Right(e))
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

class GetGasTokenError extends Error {
  constructor() {
    super("Get gas token failed");
  }
}
