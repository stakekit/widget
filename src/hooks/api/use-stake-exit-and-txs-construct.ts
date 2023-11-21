import {
  GasModeValueDto,
  ActionRequestDto,
  actionExit,
} from "@stakekit/api-hooks";
import { withRequestErrorRetry } from "../../common/utils";
import { GetEitherAsyncLeft, GetEitherAsyncRight } from "../../types";
import { useSKWallet } from "../../providers/sk-wallet";
import { constructTxs } from "../../common/construct-txs";
import { useMutation } from "@tanstack/react-query";
import { useMutationSharedState } from "../use-mutation-shared-state";

const mutationKey = ["stake-exit"];

export const useStakeExitAndTxsConstruct = () => {
  const { isLedgerLive } = useSKWallet();

  return useMutation<
    GetEitherAsyncRight<ReturnType<typeof fn>>,
    GetEitherAsyncLeft<ReturnType<typeof fn>>,
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

export const useStakeExitAndTxsConstructMutationState = (): ReturnType<
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
  withRequestErrorRetry({ fn: () => actionExit(stakeRequestDto) })
    .mapLeft(() => new Error("Stake exit error"))
    .chain((actionDto) =>
      constructTxs({ actionDto, gasModeValue, isLedgerLive })
    )
    .map((val) => ({ ...val, stakeExitRes: val.mappedActionDto }));
