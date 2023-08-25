import { EitherAsync, Right } from "purify-ts";
import { useMutation } from "@tanstack/react-query";
import { getAverageGasMode } from "../../../api/get-gas-mode-value";
import { useStakeExitAndTxsConstruct } from "../../../hooks/api/use-stake-exit-and-txs-construct";
import { checkGasAmount } from "../../../api/check-gas-amount";
import { useStakeExitRequestDto } from "./use-stake-exit-request-dto";

export const useOnStakeExit = () => {
  const stakeExitAndTxsConstruct = useStakeExitAndTxsConstruct();

  return useMutation(
    async ({
      stakeRequestDto,
    }: {
      stakeRequestDto: ReturnType<typeof useStakeExitRequestDto>;
    }) => {
      const result = await EitherAsync.liftEither(
        stakeRequestDto.toEither(new Error("Stake request not ready"))
      )
        .chain((val) =>
          getAverageGasMode(val.gasFeeToken.network)
            .chainLeft(async () => Right(null))
            .map((gas) => ({ stakeRequestDto: val, gas }))
        )
        .chain((val) =>
          EitherAsync(() =>
            stakeExitAndTxsConstruct.mutateAsync({
              gasModeValue: val.gas ?? undefined,
              stakeRequestDto: val.stakeRequestDto,
            })
          )
            .map((res) => ({ ...val, ...res }))
            .mapLeft(() => new Error("Stake exit and txs construct failed"))
        )
        .chain(({ stakeRequestDto, stakeExitRes, transactionConstructRes }) =>
          checkGasAmount({
            addressWithTokenDto: {
              address: stakeRequestDto.addresses.address,
              additionalAddresses:
                stakeRequestDto.addresses.additionalAddresses,
              network: stakeRequestDto.gasFeeToken.network,
              tokenAddress: stakeRequestDto.gasFeeToken.address,
            },
            transactionConstructRes,
          }).map(() => ({ stakeExitRes, transactionConstructRes }))
        );

      return result.caseOf({
        Left: (e) => Promise.reject(e),
        Right: (v) => Promise.resolve(v),
      });
    }
  );
};
