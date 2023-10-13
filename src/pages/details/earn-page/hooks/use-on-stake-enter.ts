import { useMutation } from "@tanstack/react-query";
import { EitherAsync, Right } from "purify-ts";
import { getAverageGasMode } from "../../../../common/get-gas-mode-value";
import {
  ErrorType,
  useStakeEnterAndTxsConstruct,
} from "../../../../hooks/api/use-stake-enter-and-txs-construct";
import { useStakeEnterRequestDto } from "./use-stake-enter-request-dto";
import { checkGasAmount } from "../../../../common/check-gas-amount";
import { GetEitherAsyncLeft, GetEitherAsyncRight } from "../../../../types";

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
          .map((gas) => ({
            stakeRequestDto: val.dto,
            gasFeeToken: val.gasFeeToken,
            gas,
          }))
      )
      .chain((val) =>
        EitherAsync(() =>
          stakeEnterAndTxsConstruct.mutateAsync({
            stakeRequestDto: val.stakeRequestDto,
            gasModeValue: val.gas ?? undefined,
          })
        )
          .mapLeft((e) => e as ErrorType)
          .map((res) => ({ ...val, ...res }))
      )
      .chain(
        ({
          stakeRequestDto,
          gasFeeToken,
          stakeEnterRes,
          transactionConstructRes,
        }) =>
          checkGasAmount({
            addressWithTokenDto: {
              address: stakeRequestDto.addresses.address,
              additionalAddresses:
                stakeRequestDto.addresses.additionalAddresses,
              network: gasFeeToken.network,
              tokenAddress: gasFeeToken.address,
            },
            transactionConstructRes,
          }).map(() => ({ stakeEnterRes, transactionConstructRes }))
      );

  return useMutation<
    GetEitherAsyncRight<ReturnType<typeof fn>>,
    GetEitherAsyncLeft<ReturnType<typeof fn>>,
    ReturnType<typeof useStakeEnterRequestDto>
  >(async (stakeRequestDto) => {
    return (await fn({ stakeRequestDto })).caseOf({
      Left: (e) => Promise.reject(e),
      Right: (v) => Promise.resolve(v),
    });
  });
};
