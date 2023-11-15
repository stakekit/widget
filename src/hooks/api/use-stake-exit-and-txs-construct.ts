import {
  GasModeValueDto,
  ActionRequestDto,
  actionExit,
} from "@stakekit/api-hooks";
import { useSharedMutation } from "../use-shared-mutation";
import { withRequestErrorRetry } from "../../common/utils";
import { GetEitherAsyncLeft, GetEitherAsyncRight } from "../../types";
import { useSKWallet } from "../../providers/sk-wallet";
import { constructTxs } from "../../common/construct-txs";

export const useStakeExitAndTxsConstruct = () => {
  const { isLedgerLive } = useSKWallet();

  return useSharedMutation<
    GetEitherAsyncRight<ReturnType<typeof fn>>,
    GetEitherAsyncLeft<ReturnType<typeof fn>>,
    {
      stakeRequestDto: ActionRequestDto;
      gasModeValue: GasModeValueDto | undefined;
    }
  >(["stake-exit"], async (args) => {
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
  withRequestErrorRetry({ fn: () => actionExit(stakeRequestDto) })
    .mapLeft(() => new Error("Stake exit error"))
    .chain((actionDto) =>
      constructTxs({ actionDto, gasModeValue, isLedgerLive })
    )
    .map((val) => ({ ...val, stakeExitRes: val.mappedActionDto }));
