import { EitherAsync, Right } from "purify-ts";
import { getAverageGasMode } from "../../../common/get-gas-mode-value";
import { usePendingActionAndTxsConstruct } from "../../../hooks/api/use-pending-action-and-txs-construct";
import { checkGasAmount } from "../../../common/check-gas-amount";
import { preparePendingActionRequestDto } from "./utils";
import {
  GetEitherAsyncLeft,
  GetEitherAsyncRight,
  GetEitherRight,
} from "../../../types";
import { YieldBalanceDto } from "@stakekit/api-hooks";
import { useMutation } from "@tanstack/react-query";
import { useMutationSharedState } from "../../../hooks/use-mutation-shared-state";

const mutationKey = ["on-pending-action"];

export const useOnPendingAction = () => {
  const pendingActionAndTxsConstruct = usePendingActionAndTxsConstruct();

  return useMutation<
    GetEitherAsyncRight<ReturnType<typeof fn>>,
    GetEitherAsyncLeft<ReturnType<typeof fn>>,
    {
      pendingActionRequestDto: GetEitherRight<
        ReturnType<typeof preparePendingActionRequestDto>
      >;
      yieldBalance: YieldBalanceDto;
    }
  >({
    mutationKey,
    mutationFn: async (args) =>
      (
        await fn({
          ...args,
          pendingActionAndTxsConstruct:
            pendingActionAndTxsConstruct.mutateAsync,
        })
      ).unsafeCoerce(),
  });
};

export const useOnPendingActionMutationState = (): ReturnType<
  typeof useMutationSharedState<GetEitherAsyncRight<ReturnType<typeof fn>>>
> =>
  useMutationSharedState<GetEitherAsyncRight<ReturnType<typeof fn>>>({
    mutationKey,
  });

const fn = ({
  pendingActionRequestDto,
  yieldBalance,
  pendingActionAndTxsConstruct,
}: {
  pendingActionRequestDto: GetEitherRight<
    ReturnType<typeof preparePendingActionRequestDto>
  >;
  yieldBalance: YieldBalanceDto;
  pendingActionAndTxsConstruct: ReturnType<
    typeof usePendingActionAndTxsConstruct
  >["mutateAsync"];
}) =>
  getAverageGasMode(pendingActionRequestDto.gasFeeToken.network)
    .chainLeft(async () => Right(null))
    .chain((val) =>
      EitherAsync(() =>
        pendingActionAndTxsConstruct({
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
      }).map(() => ({
        pendingActionRes,
        transactionConstructRes,
        yieldBalance,
      }))
    );
