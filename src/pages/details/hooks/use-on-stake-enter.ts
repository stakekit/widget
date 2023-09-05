import { useMutation } from "@tanstack/react-query";
import { EitherAsync, Right } from "purify-ts";
import { getAverageGasMode } from "../../../api/get-gas-mode-value";
import { useStakeEnterAndTxsConstruct } from "../../../hooks/api/use-stake-enter-and-txs-construct";
import { useStakeEnterRequestDto } from "./use-stake-enter-request-dto";
import { checkGasAmount } from "../../../api/check-gas-amount";

export const useOnStakeEnter = () => {
  const stakeEnterAndTxsConstruct = useStakeEnterAndTxsConstruct();

  const fn = ({
    stakeRequestDto,
  }: {
    stakeRequestDto: ReturnType<typeof useStakeEnterRequestDto>;
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
          stakeEnterAndTxsConstruct.mutateAsync({
            stakeRequestDto: val.stakeRequestDto,
            gasModeValue: val.gas ?? undefined,
          })
        )
          .mapLeft(() => new Error("Stake enter and txs construct failed"))
          .map((res) => ({ ...val, ...res }))
      )
      .chain(({ stakeRequestDto, stakeEnterRes, transactionConstructRes }) =>
        checkGasAmount({
          addressWithTokenDto: {
            address: stakeRequestDto.addresses.address,
            additionalAddresses: stakeRequestDto.addresses.additionalAddresses,
            network: stakeRequestDto.gasFeeToken.network,
            tokenAddress: stakeRequestDto.gasFeeToken.address,
          },
          transactionConstructRes,
        }).map(() => ({ stakeEnterRes, transactionConstructRes }))
      );

  return useMutation(
    async (stakeRequestDto: ReturnType<typeof useStakeEnterRequestDto>) => {
      return await fn({ stakeRequestDto }).caseOf({
        Left: (e) => Promise.reject(e),
        Right: (v) => Promise.resolve(v),
      });
    }
  );
};
