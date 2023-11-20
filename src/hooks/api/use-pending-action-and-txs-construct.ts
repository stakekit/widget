import {
  GasModeValueDto,
  PendingActionRequestDto,
  actionPending,
} from "@stakekit/api-hooks";
import { withRequestErrorRetry } from "../../common/utils";
import { GetEitherAsyncLeft, GetEitherAsyncRight } from "../../types";
import { useSKWallet } from "../../providers/sk-wallet";
import { constructTxs } from "../../common/construct-txs";
import { useMutation } from "@tanstack/react-query";
import { useMutationSharedState } from "../use-mutation-shared-state";

const mutationKey = ["pending-action"];

export const usePendingActionAndTxsConstruct = () => {
  const { isLedgerLive } = useSKWallet();

  return useMutation<
    GetEitherAsyncRight<ReturnType<typeof fn>>,
    GetEitherAsyncLeft<ReturnType<typeof fn>>,
    {
      pendingActionRequestDto: PendingActionRequestDto;
      gasModeValue: GasModeValueDto | undefined;
    }
  >({
    mutationKey,
    mutationFn: async (args) =>
      (await fn({ ...args, isLedgerLive })).unsafeCoerce(),
  });
};

export const usePendingActionAndTxsConstructMutationState = (): ReturnType<
  typeof useMutationSharedState<GetEitherAsyncRight<ReturnType<typeof fn>>>
> =>
  useMutationSharedState<GetEitherAsyncRight<ReturnType<typeof fn>>>({
    mutationKey,
  });

const fn = ({
  gasModeValue,
  pendingActionRequestDto,
  isLedgerLive,
}: {
  pendingActionRequestDto: PendingActionRequestDto;
  gasModeValue: GasModeValueDto | undefined;
  isLedgerLive: boolean;
}) =>
  withRequestErrorRetry({
    fn: () => actionPending(pendingActionRequestDto),
  })
    .mapLeft(() => new Error("Pending actions error"))
    .chain((actionDto) =>
      constructTxs({ actionDto, gasModeValue, isLedgerLive })
    )
    .map((val) => ({ ...val, pendingActionRes: val.mappedActionDto }));
