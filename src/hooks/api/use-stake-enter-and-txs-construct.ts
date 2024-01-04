import {
  GasModeValueDto,
  ActionRequestDto,
  actionEnter,
} from "@stakekit/api-hooks";
import { GetEitherAsyncLeft, GetEitherAsyncRight } from "../../types";
import { isAxiosError, withRequestErrorRetry } from "../../common/utils";
import { useSKWallet } from "../../providers/sk-wallet";
import { constructTxs } from "../../common/construct-txs";
import { useMutation } from "@tanstack/react-query";
import { useMutationSharedState } from "../use-mutation-shared-state";

type DataType = GetEitherAsyncRight<ReturnType<typeof fn>>;
export type ErrorType = GetEitherAsyncLeft<ReturnType<typeof fn>>;

const mutationKey = ["stake-enter"];

export const useStakeEnterAndTxsConstruct = () => {
  const { isLedgerLive } = useSKWallet();

  return useMutation<
    DataType,
    ErrorType,
    {
      stakeRequestDto: ActionRequestDto;
      gasModeValue: GasModeValueDto | undefined;
    }
  >({
    mutationKey,
    mutationFn: async (args) =>
      (await fn({ ...args, isLedgerLive })).unsafeCoerce(),
  });
};

export const useStakeEnterAndTxsConstructMutationState = (): ReturnType<
  typeof useMutationSharedState<GetEitherAsyncRight<ReturnType<typeof fn>>>
> =>
  useMutationSharedState<GetEitherAsyncRight<ReturnType<typeof fn>>>({
    mutationKey,
  });

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
    .chain((actionDto) =>
      constructTxs({ actionDto, gasModeValue, isLedgerLive })
    )
    .map((val) => {
      return { ...val, stakeEnterRes: val.mappedActionDto };
    });

export class StakingNotAllowedError extends Error {
  static isStakingNotAllowedErrorDto = (e: unknown) => {
    const dto = e as undefined | { type: string; code: number };

    return dto && dto.code === 422 && dto.type === "STAKING_ERROR";
  };

  constructor() {
    super("Staking not allowed, needs unstaking and trying again");
  }
}
