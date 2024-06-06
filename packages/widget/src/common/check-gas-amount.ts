import { equalTokens } from "@sk-widget/domain";
import type { ActionDtoWithGasEstimate } from "@sk-widget/domain/types/action";
import type {
  AddressWithTokenDto,
  TokenDto,
  useTokenGetTokenBalancesHook,
} from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { EitherAsync, Left, List, Right } from "purify-ts";
import { withRequestErrorRetry } from "./utils";

export type CheckGasAmountIfStake =
  | { isStake: true; stakeToken: TokenDto; stakeAmount: BigNumber }
  | { isStake: false };

export const checkGasAmount = ({
  addressWithTokenDto,
  gasEstimate,
  tokenGetTokenBalances,
  ...rest
}: {
  addressWithTokenDto: AddressWithTokenDto;
  gasEstimate: ActionDtoWithGasEstimate["gasEstimate"];
  tokenGetTokenBalances: ReturnType<typeof useTokenGetTokenBalancesHook>;
} & CheckGasAmountIfStake) =>
  withRequestErrorRetry({
    fn: () => tokenGetTokenBalances({ addresses: [addressWithTokenDto] }),
  })
    .mapLeft(() => new GetGasTokenError())
    .chain((res) =>
      EitherAsync.liftEither(
        List.head(res)
          .map((val) => ({ ...val, amount: new BigNumber(val.amount ?? 0) }))
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
