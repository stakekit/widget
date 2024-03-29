import { EitherAsync, Right } from "purify-ts";
import { useMutation } from "@tanstack/react-query";
import { getAverageGasMode } from "../../../common/get-gas-mode-value";
import { useStakeExitAndTxsConstruct } from "../../../hooks/api/use-stake-exit-and-txs-construct";
import { useStakeExitRequestDto } from "./use-stake-exit-request-dto";
import {
  GetEitherAsyncLeft,
  GetEitherAsyncRight,
  GetMaybeJust,
} from "../../../types";
import { useSettings } from "../../../providers/settings";
import { useSKWallet } from "../../../providers/sk-wallet";
import {
  useActionExitHook,
  useTokenGetTokenBalancesHook,
  useTransactionConstructHook,
  useTransactionGetGasForNetworkHook,
} from "@stakekit/api-hooks";

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
    { stakeRequestDto: GetMaybeJust<ReturnType<typeof useStakeExitRequestDto>> }
  >({
    mutationFn: async ({ stakeRequestDto }) =>
      (
        await fn({
          stakeRequestDto,
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
}: {
  stakeRequestDto: GetMaybeJust<ReturnType<typeof useStakeExitRequestDto>>;
  stakeExitAndTxsConstruct: ReturnType<
    typeof useStakeExitAndTxsConstruct
  >["mutateAsync"];
  disableGasCheck: boolean;
  isLedgerLive: boolean;
  transactionGetGasForNetwork: ReturnType<
    typeof useTransactionGetGasForNetworkHook
  >;
  actionExit: ReturnType<typeof useActionExitHook>;
  transactionConstruct: ReturnType<typeof useTransactionConstructHook>;
  tokenGetTokenBalances: ReturnType<typeof useTokenGetTokenBalancesHook>;
}) =>
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
        })
      )
        .map((res) => ({ ...val, ...res }))
        .mapLeft(() => new Error("Stake exit and txs construct failed"))
    );
