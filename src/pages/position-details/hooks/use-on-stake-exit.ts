import { EitherAsync, Right } from "purify-ts";
import { useMutation } from "@tanstack/react-query";
import { getAverageGasMode } from "../../../common/get-gas-mode-value";
import { useStakeExitAndTxsConstruct } from "../../../hooks/api/use-stake-exit-and-txs-construct";
import { checkGasAmount } from "../../../common/check-gas-amount";
import { useStakeExitRequestDto } from "./use-stake-exit-request-dto";

export const useOnStakeExit = () => {
  const stakeExitAndTxsConstruct = useStakeExitAndTxsConstruct();

  const fn = ({
    stakeRequestDto,
  }: {
    stakeRequestDto: ReturnType<typeof useStakeExitRequestDto>;
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
          stakeExitAndTxsConstruct.mutateAsync({
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

  return useMutation(
    async ({
      stakeRequestDto,
    }: {
      stakeRequestDto: ReturnType<typeof useStakeExitRequestDto>;
    }) => {
      return (await fn({ stakeRequestDto })).caseOf({
        Left: (e) => Promise.reject(e),
        Right: (v) => Promise.resolve(v),
      });
    }
  );
};
