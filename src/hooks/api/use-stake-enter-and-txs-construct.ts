import {
  GasModeValueDto,
  ActionRequestDto,
  actionEnter,
  transactionConstruct,
} from "@stakekit/api-hooks";
import { EitherAsync } from "purify-ts";
import { useSharedMutation } from "../use-shared-mutation";
import { getValidStakeSessionTx } from "../../domain";
import { useSKWallet } from "../wallet/use-sk-wallet";
import { GetEitherAsyncLeft, GetEitherAsyncRight } from "../../types";
import { isAxiosError, withRequestErrorRetry } from "../../common/utils";

export type DataType = GetEitherAsyncRight<ReturnType<typeof fn>>;
export type ErrorType = GetEitherAsyncLeft<ReturnType<typeof fn>>;

export const useStakeEnterAndTxsConstruct = () => {
  const { isLedgerLive } = useSKWallet();

  return useSharedMutation<
    GetEitherAsyncRight<ReturnType<typeof fn>>,
    GetEitherAsyncLeft<ReturnType<typeof fn>>,
    {
      stakeRequestDto: ActionRequestDto;
      gasModeValue: GasModeValueDto | undefined;
    }
  >(["stake-enter"], async (args) => {
    return (await fn({ ...args, isLedgerLive })).caseOf({
      Left: (e) => Promise.reject(e),
      Right: (r) => Promise.resolve(r),
    });
  });
};

const fn = ({
  gasModeValue,
  stakeRequestDto,
  isLedgerLive,
}: {
  stakeRequestDto: ActionRequestDto;
  gasModeValue: GasModeValueDto | undefined;
  isLedgerLive: boolean;
}) =>
  withRequestErrorRetry({ fn: () => actionEnter(stakeRequestDto) })
    .mapLeft<StakingNotAllowedError | Error>((e) => {
      if (
        isAxiosError(e) &&
        StakingNotAllowedError.isStakingNotAllowedErrorDto(e.response?.data)
      ) {
        return new StakingNotAllowedError();
      }

      return new Error("Stake enter error");
    })
    .chain((val) => EitherAsync.liftEither(getValidStakeSessionTx(val)))
    .chain((val) =>
      EitherAsync.sequence(
        val.transactions.map((tx) =>
          withRequestErrorRetry({
            fn: () =>
              transactionConstruct(tx.id, {
                gasArgs: gasModeValue?.gasArgs,
                ledgerWalletAPICompatible: isLedgerLive,
              }),
            shouldRetry: (e, retryCount) =>
              retryCount <= 3 && isAxiosError(e) && e.response?.status === 404,
          }).mapLeft(() => new Error("Transaction construct error"))
        )
      ).map((res) => ({
        stakeEnterRes: val,
        transactionConstructRes: res,
      }))
    );

export class StakingNotAllowedError extends Error {
  static isStakingNotAllowedErrorDto = (e: unknown) => {
    const dto = e as undefined | { type: string; code: number };

    return dto && dto.code === 422 && dto.type === "STAKING_ERROR";
  };

  constructor() {
    super("Staking not allowed, needs unstaking and trying again");
  }
}
