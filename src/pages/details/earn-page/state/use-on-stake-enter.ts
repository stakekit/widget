import { useEarnPageState } from "@sk-widget/pages/details/earn-page/state/earn-page-state-context";
import {
  useActionEnterHook,
  useTokenGetTokenBalancesHook,
  useTransactionConstructHook,
  useTransactionGetGasForNetworkHook,
} from "@stakekit/api-hooks";
import { EitherAsync, Right } from "purify-ts";
import { getAverageGasMode } from "../../../../common/get-gas-mode-value";
import type { ErrorType } from "../../../../hooks/api/use-stake-enter-and-txs-construct";
import { useStakeEnterAndTxsConstruct } from "../../../../hooks/api/use-stake-enter-and-txs-construct";
import { useMutationSync } from "../../../../hooks/use-mutation-sync";
import { useSettings } from "../../../../providers/settings";
import { useSKWallet } from "../../../../providers/sk-wallet";
import type {
  GetEitherAsyncLeft,
  GetEitherAsyncRight,
} from "../../../../types";
import type { useStakeEnterRequestDto } from "./use-stake-enter-request-dto";

export const useOnStakeEnter = () => {
  const stakeEnterAndTxsConstruct = useStakeEnterAndTxsConstruct();

  const { address, network, isLedgerLive } = useSKWallet();
  const { selectedToken, selectedStakeId, selectedValidators } =
    useEarnPageState();

  const { disableGasCheck = false } = useSettings();

  const actionEnter = useActionEnterHook();
  const transactionGetGasForNetwork = useTransactionGetGasForNetworkHook();

  const tokenGetTokenBalances = useTokenGetTokenBalancesHook();
  const transactionConstruct = useTransactionConstructHook();

  return useMutationSync<
    GetEitherAsyncRight<ReturnType<typeof fn>>,
    GetEitherAsyncLeft<ReturnType<typeof fn>>,
    Pick<Parameters<typeof fn>[0], "stakeRequestDto" | "stakeEnterData">
  >({
    syncOn: [
      address,
      network,
      selectedToken,
      selectedStakeId,
      selectedValidators,
    ],
    mutationFn: async ({ stakeEnterData, stakeRequestDto }) =>
      (
        await fn({
          stakeRequestDto,
          stakeEnterAndTxsConstruct: stakeEnterAndTxsConstruct.mutateAsync,
          disableGasCheck,
          isLedgerLive,
          actionEnter,
          transactionGetGasForNetwork,
          tokenGetTokenBalances,
          transactionConstruct,
          stakeEnterData,
        })
      ).unsafeCoerce(),
  });
};

const fn = ({
  stakeRequestDto,
  stakeEnterAndTxsConstruct,
  disableGasCheck,
  isLedgerLive,
  transactionGetGasForNetwork,
  actionEnter,
  tokenGetTokenBalances,
  transactionConstruct,
  stakeEnterData,
}: {
  stakeRequestDto: ReturnType<typeof useStakeEnterRequestDto>;
  stakeEnterAndTxsConstruct: ReturnType<
    typeof useStakeEnterAndTxsConstruct
  >["mutateAsync"];
  transactionGetGasForNetwork: ReturnType<
    typeof useTransactionGetGasForNetworkHook
  >;
} & Pick<
  Parameters<ReturnType<typeof useStakeEnterAndTxsConstruct>["mutateAsync"]>[0],
  | "isLedgerLive"
  | "disableGasCheck"
  | "actionEnter"
  | "tokenGetTokenBalances"
  | "transactionConstruct"
  | "stakeEnterData"
>) =>
  EitherAsync.liftEither(
    stakeRequestDto.toEither(new Error("Stake request not ready"))
  )
    .chain((val) =>
      getAverageGasMode({
        network: val.gasFeeToken.network,
        transactionGetGasForNetwork,
      })
        .chainLeft(async () => Right(null))
        .map((gas) => ({
          stakeRequestDto: val.dto,
          gasFeeToken: val.gasFeeToken,
          gas,
        }))
    )
    .chain((val) =>
      EitherAsync(() =>
        stakeEnterAndTxsConstruct({
          stakeRequestDto: val.stakeRequestDto,
          gasModeValue: val.gas ?? undefined,
          disableGasCheck,
          gasFeeToken: val.gasFeeToken,
          isLedgerLive,
          actionEnter,
          tokenGetTokenBalances,
          transactionConstruct,
          stakeEnterData,
        })
      )
        .mapLeft((e) => e as ErrorType)
        .map((res) => ({ ...val, ...res }))
    );
