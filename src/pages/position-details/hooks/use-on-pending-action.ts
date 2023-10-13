import { EitherAsync, Right } from "purify-ts";
import { getAverageGasMode } from "../../../common/get-gas-mode-value";
import { usePendingActionAndTxsConstruct } from "../../../hooks/api/use-pending-action-and-txs-construct";
import { checkGasAmount } from "../../../common/check-gas-amount";
import { useMutation } from "@tanstack/react-query";
import { preparePendingActionRequestDto } from "./utils";
import { GetEitherRight } from "../../../types";

export const useOnPendingAction = () => {
  const pendingActionAndTxsConstruct = usePendingActionAndTxsConstruct();

  const fn = ({
    pendingActionRequestDto,
  }: {
    pendingActionRequestDto: GetEitherRight<
      ReturnType<typeof preparePendingActionRequestDto>
    >;
  }) =>
    getAverageGasMode(pendingActionRequestDto.gasFeeToken.network)
      .chainLeft(async () => Right(null))
      .chain((val) =>
        EitherAsync(() =>
          pendingActionAndTxsConstruct.mutateAsync({
            gasModeValue: val ?? undefined,
            pendingActionRequestDto: {
              integrationId: pendingActionRequestDto.integrationId,
              type: pendingActionRequestDto.type,
              passthrough: pendingActionRequestDto.passthrough,
              args: pendingActionRequestDto.args,
            },
          })
        )
          .mapLeft(() => new Error("Stake claim and txs construct failed"))
          .map((res) => ({ ...val, ...res }))
      )
      .chain(({ pendingActionRes, transactionConstructRes }) =>
        checkGasAmount({
          addressWithTokenDto: {
            address: pendingActionRequestDto.address,
            additionalAddresses: pendingActionRequestDto.additionalAddresses,
            network: pendingActionRequestDto.gasFeeToken.network,
            tokenAddress: pendingActionRequestDto.gasFeeToken.address,
          },
          transactionConstructRes,
        }).map(() => ({ pendingActionRes, transactionConstructRes }))
      );

  return useMutation(
    async ({
      pendingActionRequestDto,
    }: {
      pendingActionRequestDto: GetEitherRight<
        ReturnType<typeof preparePendingActionRequestDto>
      >;
    }) => {
      return (await fn({ pendingActionRequestDto })).caseOf({
        Left: (e) => Promise.reject(e),
        Right: (v) => Promise.resolve(v),
      });
    }
  );
};
