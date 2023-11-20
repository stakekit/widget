import { EitherAsync, Right } from "purify-ts";
import { useMutation } from "@tanstack/react-query";
import { getAverageGasMode } from "../../../common/get-gas-mode-value";
import { useStakeExitAndTxsConstruct } from "../../../hooks/api/use-stake-exit-and-txs-construct";
import { checkGasAmount } from "../../../common/check-gas-amount";
import { useStakeExitRequestDto } from "./use-stake-exit-request-dto";
import { GetEitherAsyncLeft, GetEitherAsyncRight } from "../../../types";

export const useOnStakeExit = () => {
  const stakeExitAndTxsConstruct = useStakeExitAndTxsConstruct();

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
        })
      ).unsafeCoerce(),
  });
};

const fn = ({
  stakeRequestDto,
  stakeExitAndTxsConstruct,
}: {
  stakeRequestDto: ReturnType<typeof useStakeExitRequestDto>;
  stakeExitAndTxsConstruct: ReturnType<
    typeof useStakeExitAndTxsConstruct
  >["mutateAsync"];
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
        })
      )
        .map((res) => ({ ...val, ...res }))
        .mapLeft(() => new Error("Stake exit and txs construct failed"))
    )
    .chain(({ stakeRequestDto, stakeExitRes, transactionConstructRes }) =>
      checkGasAmount({
        addressWithTokenDto: {
          address: stakeRequestDto.dto.addresses.address,
          additionalAddresses:
            stakeRequestDto.dto.addresses.additionalAddresses,
          network: stakeRequestDto.gasFeeToken.network,
          tokenAddress: stakeRequestDto.gasFeeToken.address,
        },
        transactionConstructRes,
      }).map(() => ({ stakeExitRes, transactionConstructRes }))
    );
