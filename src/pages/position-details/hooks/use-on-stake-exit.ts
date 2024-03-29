import { EitherAsync, Right } from "purify-ts";
import { useMutation } from "@tanstack/react-query";
import { getAverageGasMode } from "../../../common/get-gas-mode-value";
import { useStakeExitAndTxsConstruct } from "../../../hooks/api/use-stake-exit-and-txs-construct";
import { useStakeExitRequestDto } from "./use-stake-exit-request-dto";
import { GetEitherAsyncLeft, GetEitherAsyncRight } from "../../../types";
import { useSettings } from "../../../providers/settings";
import { useSKWallet } from "../../../providers/sk-wallet";

export const useOnStakeExit = () => {
  const stakeExitAndTxsConstruct = useStakeExitAndTxsConstruct();

  const { disableGasCheck = false } = useSettings();

  const { isLedgerLive } = useSKWallet();

  return useMutation<
    GetEitherAsyncRight<ReturnType<typeof fn>>,
    GetEitherAsyncLeft<ReturnType<typeof fn>>,
    {
      stakeRequestDto: ReturnType<typeof useStakeExitRequestDto>;
    }
  >({
    mutationFn: async ({ stakeRequestDto }) =>
      (
        await fn({
          stakeRequestDto,
          stakeExitAndTxsConstruct: stakeExitAndTxsConstruct.mutateAsync,
          disableGasCheck,
          isLedgerLive,
        })
      ).unsafeCoerce(),
  });
};

const fn = ({
  stakeRequestDto,
  stakeExitAndTxsConstruct,
  disableGasCheck,
  isLedgerLive,
}: {
  stakeRequestDto: ReturnType<typeof useStakeExitRequestDto>;
  stakeExitAndTxsConstruct: ReturnType<
    typeof useStakeExitAndTxsConstruct
  >["mutateAsync"];
  disableGasCheck: boolean;
  isLedgerLive: boolean;
}) =>
  EitherAsync.liftEither(
    stakeRequestDto.toEither(new Error("Stake request not ready"))
  )
    .chain((val) =>
      getAverageGasMode(val.gasFeeToken.network)
        .chainLeft(async () => Right(null))
        .map((gas) => ({ stakeRequestDto: val, gas }))
    )
    .chain((val) =>
      EitherAsync(() =>
        stakeExitAndTxsConstruct({
          gasModeValue: val.gas ?? undefined,
          stakeRequestDto: val.stakeRequestDto.dto,
          disableGasCheck,
          isLedgerLive,
          gasFeeToken: val.stakeRequestDto.gasFeeToken,
        })
      )
        .map((res) => ({ ...val, ...res }))
        .mapLeft(() => new Error("Stake exit and txs construct failed"))
    );
