import { EitherAsync, Right } from "purify-ts";
import { getAverageGasMode } from "../../../api/get-gas-mode-value";
import { usePendingActionAndTxsConstruct } from "../../../hooks/api/use-pending-action-and-txs-construct";
import { useStakeClaimRequestDto } from "./use-stake-claim-request.dto";
import { checkGasAmount } from "../../../api/check-gas-amount";
import { useMutation } from "@tanstack/react-query";

export const useOnClaim = () => {
  const pendingActionAndTxsConstruct = usePendingActionAndTxsConstruct();

  const fn = ({
    stakeRequestDto,
  }: {
    stakeRequestDto: ReturnType<typeof useStakeClaimRequestDto>;
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
          pendingActionAndTxsConstruct.mutateAsync({
            gasModeValue: val.gas ?? undefined,
            pendingActionRequestDto: {
              integrationId: val.stakeRequestDto.integrationId,
              type: val.stakeRequestDto.type,
              passthrough: val.stakeRequestDto.passthrough,
              args: val.stakeRequestDto.args,
            },
          })
        )
          .mapLeft(() => new Error("Stake claim and txs construct failed"))
          .map((res) => ({ ...val, ...res }))
      )
      .chain(({ stakeRequestDto, pendingActionRes, transactionConstructRes }) =>
        checkGasAmount({
          addressWithTokenDto: {
            address: stakeRequestDto.address,
            additionalAddresses: stakeRequestDto.additionalAddresses,
            network: stakeRequestDto.gasFeeToken.network,
            tokenAddress: stakeRequestDto.gasFeeToken.address,
          },
          transactionConstructRes,
        }).map(() => ({ pendingActionRes, transactionConstructRes }))
      );

  return useMutation(
    async ({
      stakeRequestDto,
    }: {
      stakeRequestDto: ReturnType<typeof useStakeClaimRequestDto>;
    }) => {
      return await fn({ stakeRequestDto }).caseOf({
        Left: (e) => Promise.reject(e),
        Right: (v) => Promise.resolve(v),
      });
    }
  );
};
