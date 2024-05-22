import {
  useActionExitHook,
  useTokenGetTokenBalancesHook,
  useTransactionConstructHook,
  useTransactionGetGasForNetworkHook,
} from "@stakekit/api-hooks";
import { useMutation } from "@tanstack/react-query";
import { EitherAsync, Right } from "purify-ts";
import { getAverageGasMode } from "../../../common/get-gas-mode-value";
import { useStakeExitAndTxsConstruct } from "../../../hooks/api/use-stake-exit-and-txs-construct";
import { useSettings } from "../../../providers/settings";
import { useSKWallet } from "../../../providers/sk-wallet";
import type {
  GetEitherAsyncLeft,
  GetEitherAsyncRight,
  GetMaybeJust,
} from "../../../types";
import type { useStakeExitRequestDto } from "./use-stake-exit-request-dto";

export const useOnStakeExit = () => {
  const stakeExitAndTxsConstruct = useStakeExitAndTxsConstruct();

  const { disableGasCheck = false } = useSettings();

  const { isLedgerLive } = useSKWallet();

  const actionExit = useActionExitHook();
  const transactionGetGasForNetwork = useTransactionGetGasForNetworkHook();
  const transactionConstruct = useTransactionConstructHook();
  const tokenGetTokenBalances = useTokenGetTokenBalancesHook();

  return useMutation<
    GetEitherAsyncRight<ReturnType<typeof fn>>,
    GetEitherAsyncLeft<ReturnType<typeof fn>>,
    Pick<Parameters<typeof fn>[0], "stakeRequestDto" | "stakeExitData">
  >({
    mutationFn: async ({ stakeRequestDto, stakeExitData }) =>
      (
        await fn({
          stakeRequestDto,
          stakeExitData,
          stakeExitAndTxsConstruct: stakeExitAndTxsConstruct.mutateAsync,
          disableGasCheck,
          isLedgerLive,
          actionExit,
          transactionGetGasForNetwork,
          transactionConstruct,
          tokenGetTokenBalances,
        })
      ).unsafeCoerce(),
  });
};

const fn = ({
  stakeRequestDto,
  stakeExitAndTxsConstruct,
  disableGasCheck,
  isLedgerLive,
  transactionGetGasForNetwork,
  actionExit,
  transactionConstruct,
  tokenGetTokenBalances,
  stakeExitData,
}: {
  stakeRequestDto: GetMaybeJust<ReturnType<typeof useStakeExitRequestDto>>;
  stakeExitAndTxsConstruct: ReturnType<
    typeof useStakeExitAndTxsConstruct
  >["mutateAsync"];
  transactionGetGasForNetwork: ReturnType<
    typeof useTransactionGetGasForNetworkHook
  >;
} & Pick<
  Parameters<ReturnType<typeof useStakeExitAndTxsConstruct>["mutateAsync"]>[0],
  | "isLedgerLive"
  | "disableGasCheck"
  | "actionExit"
  | "tokenGetTokenBalances"
  | "transactionConstruct"
  | "stakeExitData"
>) =>
  getAverageGasMode({
    network: stakeRequestDto.gasFeeToken.network,
    transactionGetGasForNetwork,
  })
    .chainLeft(async () => Right(null))
    .chain((val) =>
      EitherAsync(() =>
        stakeExitAndTxsConstruct({
          transactionConstruct,
          tokenGetTokenBalances,
          actionExit,
          gasModeValue: val ?? undefined,
          stakeRequestDto: stakeRequestDto.dto,
          disableGasCheck,
          isLedgerLive,
          gasFeeToken: stakeRequestDto.gasFeeToken,
          stakeExitData,
        })
      )
        .map((res) => ({ ...val, ...res }))
        .mapLeft(() => new Error("Stake exit and txs construct failed"))
    );
