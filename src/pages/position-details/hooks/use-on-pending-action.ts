import { Right } from "purify-ts";
import { getAverageGasMode } from "../../../common/get-gas-mode-value";
import { pendingActionAndTxsConstruct } from "../../../hooks/api/use-pending-action-and-txs-construct";
import { checkGasAmount } from "../../../common/check-gas-amount";
import { preparePendingActionRequestDto } from "./utils";
import {
  GetEitherAsyncLeft,
  GetEitherAsyncRight,
  GetEitherRight,
} from "../../../types";
import { useSKWallet } from "../../../providers/sk-wallet";
import {
  setSharedMutationData,
  setSharedMutationError,
  useSharedMutation,
} from "../../../hooks/use-shared-mutation";
import { YieldBalanceDto } from "@stakekit/api-hooks";

const mutationKey = ["on-pending-action"];

export const useOnPendingAction = () => {
  const { isLedgerLive } = useSKWallet();

  return useSharedMutation<
    GetEitherAsyncRight<ReturnType<typeof onPendingAction>>,
    GetEitherAsyncLeft<ReturnType<typeof onPendingAction>>,
    {
      pendingActionRequestDto: GetEitherRight<
        ReturnType<typeof preparePendingActionRequestDto>
      >;
      yieldBalance: YieldBalanceDto;
    }
  >(mutationKey, async ({ pendingActionRequestDto, yieldBalance }) =>
    (
      await onPendingAction({
        pendingActionRequestDto,
        isLedgerLive,
        yieldBalance,
      })
    ).unsafeCoerce()
  );
};

export const onPendingAction = (...params: Parameters<typeof fn>) =>
  fn(...params)
    .ifRight((data) => setSharedMutationData({ data, mutationKey }))
    .ifLeft((e) => setSharedMutationError({ mutationKey, err: e }));

const fn = ({
  isLedgerLive,
  pendingActionRequestDto,
  yieldBalance,
}: {
  isLedgerLive: boolean;
  pendingActionRequestDto: GetEitherRight<
    ReturnType<typeof preparePendingActionRequestDto>
  >;
  yieldBalance: YieldBalanceDto;
}) =>
  getAverageGasMode(pendingActionRequestDto.gasFeeToken.network)
    .chainLeft(async () => Right(null))
    .chain((val) =>
      pendingActionAndTxsConstruct({
        isLedgerLive,
        gasModeValue: val ?? undefined,
        pendingActionRequestDto: {
          integrationId: pendingActionRequestDto.integrationId,
          type: pendingActionRequestDto.type,
          passthrough: pendingActionRequestDto.passthrough,
          args: pendingActionRequestDto.args,
        },
      })
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
