import { EitherAsync, Right } from "purify-ts";
import { getAverageGasMode } from "../../../common/get-gas-mode-value";
import { usePendingActionAndTxsConstruct } from "../../../hooks/api/use-pending-action-and-txs-construct";
import type { preparePendingActionRequestDto } from "./utils";
import type {
  GetEitherAsyncLeft,
  GetEitherAsyncRight,
  GetEitherRight,
} from "../../../types";
import type { YieldBalanceDto } from "@stakekit/api-hooks";
import {
  useActionPendingHook,
  useTokenGetTokenBalancesHook,
  useTransactionConstructHook,
  useTransactionGetGasForNetworkHook,
} from "@stakekit/api-hooks";
import { useSettings } from "../../../providers/settings";
import { useSKWallet } from "../../../providers/sk-wallet";
import { useMutation } from "@tanstack/react-query";

const mutationKey = ["on-pending-action"];

export const useOnPendingAction = () => {
  const pendingActionAndTxsConstruct = usePendingActionAndTxsConstruct();

  const { disableGasCheck = false } = useSettings();

  const { isLedgerLive } = useSKWallet();

  const actionPending = useActionPendingHook();
  const tokenGetTokenBalances = useTokenGetTokenBalancesHook();
  const transactionConstruct = useTransactionConstructHook();
  const transactionGetGasForNetwork = useTransactionGetGasForNetworkHook();

  const value = useMutation<
    GetEitherAsyncRight<ReturnType<typeof fn>>,
    GetEitherAsyncLeft<ReturnType<typeof fn>>,
    Pick<
      Parameters<typeof fn>[0],
      "yieldBalance" | "pendingActionData" | "pendingActionRequestDto"
    >
  >({
    mutationKey,
    mutationFn: async ({
      pendingActionData,
      yieldBalance,
      pendingActionRequestDto,
    }) =>
      (
        await fn({
          pendingActionData,
          yieldBalance,
          pendingActionRequestDto,
          pendingActionAndTxsConstruct:
            pendingActionAndTxsConstruct.mutateAsync,
          disableGasCheck,
          isLedgerLive,
          actionPending,
          tokenGetTokenBalances,
          transactionConstruct,
          transactionGetGasForNetwork,
        })
      ).unsafeCoerce(),
  });

  return value;
};

const fn = ({
  pendingActionRequestDto,
  yieldBalance,
  pendingActionAndTxsConstruct,
  disableGasCheck,
  isLedgerLive,
  transactionGetGasForNetwork,
  actionPending,
  tokenGetTokenBalances,
  transactionConstruct,
  pendingActionData,
}: {
  pendingActionRequestDto: GetEitherRight<
    ReturnType<typeof preparePendingActionRequestDto>
  >;
  yieldBalance: YieldBalanceDto;
  pendingActionAndTxsConstruct: ReturnType<
    typeof usePendingActionAndTxsConstruct
  >["mutateAsync"];
  transactionGetGasForNetwork: ReturnType<
    typeof useTransactionGetGasForNetworkHook
  >;
} & Pick<
  Parameters<
    ReturnType<typeof usePendingActionAndTxsConstruct>["mutateAsync"]
  >[0],
  | "isLedgerLive"
  | "disableGasCheck"
  | "pendingActionData"
  | "actionPending"
  | "tokenGetTokenBalances"
  | "transactionConstruct"
>) =>
  getAverageGasMode({
    network: pendingActionRequestDto.gasFeeToken.network,
    transactionGetGasForNetwork,
  })
    .chainLeft(async () => Right(null))
    .chain((val) =>
      EitherAsync(() =>
        pendingActionAndTxsConstruct({
          actionPending,
          tokenGetTokenBalances,
          transactionConstruct,
          gasModeValue: val ?? undefined,
          pendingActionRequestDto: {
            integrationId: pendingActionRequestDto.integrationId,
            type: pendingActionRequestDto.type,
            passthrough: pendingActionRequestDto.passthrough,
            args: pendingActionRequestDto.args,
            addresses: {
              address: pendingActionRequestDto.address,
              additionalAddresses: pendingActionRequestDto.additionalAddresses,
            },
          },
          isLedgerLive,
          disableGasCheck,
          gasFeeToken: pendingActionRequestDto.gasFeeToken,
          pendingActionData,
        })
      )
        .mapLeft(() => new Error("Stake claim and txs construct failed"))
        .map((res) => ({ ...val, ...res }))
    )
    .map((val) => ({
      ...val,
      pendingActionToken: yieldBalance.token,
    }));
