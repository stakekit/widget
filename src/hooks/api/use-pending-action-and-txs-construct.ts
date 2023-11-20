import {
  GasModeValueDto,
  PendingActionRequestDto,
  actionPending,
} from "@stakekit/api-hooks";
import {
  setSharedMutationData,
  setSharedMutationError,
  useSharedMutation,
} from "../use-shared-mutation";
import { withRequestErrorRetry } from "../../common/utils";
import { GetEitherAsyncLeft, GetEitherAsyncRight } from "../../types";
import { useSKWallet } from "../../providers/sk-wallet";
import { constructTxs } from "../../common/construct-txs";

const mutationKey = ["pending-action"];

export const usePendingActionAndTxsConstruct = () => {
  const { isLedgerLive } = useSKWallet();

  return useSharedMutation<
    GetEitherAsyncRight<ReturnType<typeof fn>>,
    GetEitherAsyncLeft<ReturnType<typeof fn>>,
    {
      pendingActionRequestDto: PendingActionRequestDto;
      gasModeValue: GasModeValueDto | undefined;
    }
  >(mutationKey, async (args) =>
    (await fn({ ...args, isLedgerLive })).unsafeCoerce()
  );
};

export const pendingActionAndTxsConstruct = (
  ...params: Parameters<typeof fn>
) =>
  fn(...params)
    .ifRight((data) => setSharedMutationData({ data, mutationKey }))
    .ifLeft((e) => setSharedMutationError({ mutationKey, err: e }));

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
