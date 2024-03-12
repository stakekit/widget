import { EitherAsync, Right } from "purify-ts";
import { getAverageGasMode } from "../../../../common/get-gas-mode-value";
import {
  ErrorType,
  useStakeEnterAndTxsConstruct,
} from "../../../../hooks/api/use-stake-enter-and-txs-construct";
import { useStakeEnterRequestDto } from "./use-stake-enter-request-dto";
import { GetEitherAsyncLeft, GetEitherAsyncRight } from "../../../../types";
import { useMutationSync } from "../../../../hooks/use-mutation-sync";
import { useSKWallet } from "../../../../providers/sk-wallet";
import { useStakeState } from "../../../../state/stake";
import { useSettings } from "../../../../providers/settings";

export const useOnStakeEnter = () => {
  const stakeEnterAndTxsConstruct = useStakeEnterAndTxsConstruct();

  const { address, network, isLedgerLive } = useSKWallet();
  const { selectedTokenBalance, selectedStakeId, selectedValidators } =
    useStakeState();

  const { disableGasCheck = false } = useSettings();

  return useMutationSync<
    GetEitherAsyncRight<ReturnType<typeof fn>>,
    GetEitherAsyncLeft<ReturnType<typeof fn>>,
    Parameters<typeof fn>[0]["stakeRequestDto"]
  >({
    syncOn: [
      address,
      network,
      selectedTokenBalance,
      selectedStakeId,
      selectedValidators,
    ],
    mutationFn: async (stakeRequestDto) =>
      (
        await fn({
          stakeRequestDto,
          stakeEnterAndTxsConstruct: stakeEnterAndTxsConstruct.mutateAsync,
          disableGasCheck,
          isLedgerLive,
        })
      ).unsafeCoerce(),
  });
};

const fn = ({
  stakeRequestDto,
  stakeEnterAndTxsConstruct,
  disableGasCheck,
  isLedgerLive,
}: {
  stakeRequestDto: ReturnType<typeof useStakeEnterRequestDto>;
  stakeEnterAndTxsConstruct: ReturnType<
    typeof useStakeEnterAndTxsConstruct
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
        .map((gas) => ({
          stakeRequestDto: val.dto,
          gasFeeToken: val.gasFeeToken,
          gas,
        }))
    )
    .chain((val) =>
      EitherAsync(() =>
        stakeEnterAndTxsConstruct({
          stakeRequestDto: val.stakeRequestDto,
          gasModeValue: val.gas ?? undefined,
          disableGasCheck,
          gasFeeToken: val.gasFeeToken,
          isLedgerLive,
        })
      )
        .mapLeft((e) => e as ErrorType)
        .map((res) => ({ ...val, ...res }))
    );
