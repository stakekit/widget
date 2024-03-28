import {
  GasModeValueDto,
  ActionRequestDto,
  useActionExitHook,
  TokenDto,
  useTransactionConstructHook,
  useTokenGetTokenBalancesHook,
} from "@stakekit/api-hooks";
import { withRequestErrorRetry } from "../../common/utils";
import { GetEitherAsyncLeft, GetEitherAsyncRight } from "../../types";
import { UseMutationResult, useMutation } from "@tanstack/react-query";
import { PropsWithChildren, createContext, useContext } from "react";
import { actionWithGasEstimateAndCheck } from "../../common/action-with-gas-estimate-and-check";
import { getValidStakeSessionTx } from "../../domain";
import { EitherAsync } from "purify-ts";
import { useApiClient } from "../../providers/api/api-client-provider";

const mutationKey = ["stake-exit"];

const StakeExitAndTxsConstructContext = createContext<
  | UseMutationResult<
      GetEitherAsyncRight<ReturnType<typeof fn>>,
      GetEitherAsyncLeft<ReturnType<typeof fn>>,
      Omit<Parameters<typeof fn>[0], "apiClient">
    >
  | undefined
>(undefined);

export const StakeExitAndTxsConstructContextProvider = ({
  children,
}: PropsWithChildren) => {
  const apiClient = useApiClient();

  const value = useMutation<
    GetEitherAsyncRight<ReturnType<typeof fn>>,
    GetEitherAsyncLeft<ReturnType<typeof fn>>,
    Omit<Parameters<typeof fn>[0], "apiClient">
  >({
    mutationKey,
    mutationFn: async (args) =>
      (await fn({ ...args, apiClient })).unsafeCoerce(),
  });

  return (
    <StakeExitAndTxsConstructContext.Provider value={value}>
      {children}
    </StakeExitAndTxsConstructContext.Provider>
  );
};

export const useStakeExitAndTxsConstruct = () => {
  const value = useContext(StakeExitAndTxsConstructContext);

  if (!value) {
    throw new Error(
      "useStakeExitAndTxsConstruct must be used within a StakeExitAndTxsConstructContextProvider"
    );
  }

  return value;
};

const fn = ({
  gasModeValue,
  stakeRequestDto,
  isLedgerLive,
  disableGasCheck,
  gasFeeToken,
  actionExit,
  transactionConstruct,
  tokenGetTokenBalances,
  apiClient,
}: {
  stakeRequestDto: ActionRequestDto;
  gasModeValue: GasModeValueDto | undefined;
  isLedgerLive: boolean;
  disableGasCheck: boolean;
  gasFeeToken: TokenDto;
  actionExit: ReturnType<typeof useActionExitHook>;
  transactionConstruct: ReturnType<typeof useTransactionConstructHook>;
  tokenGetTokenBalances: ReturnType<typeof useTokenGetTokenBalancesHook>;
  apiClient: ReturnType<typeof useApiClient>;
}) =>
  withRequestErrorRetry({ fn: () => actionExit(stakeRequestDto) })
    .mapLeft(() => new Error("Stake exit error"))
    .chain((actionDto) =>
      EitherAsync.liftEither(getValidStakeSessionTx(actionDto))
    )
    .chain((actionDto) =>
      actionWithGasEstimateAndCheck({
        apiClient,
        gasFeeToken,
        actionDto,
        disableGasCheck,
        isLedgerLive,
        gasModeValue,
        addressWithTokenDto: {
          address: stakeRequestDto.addresses.address,
          additionalAddresses: stakeRequestDto.addresses.additionalAddresses,
          network: gasFeeToken.network,
          tokenAddress: gasFeeToken.address,
        },
        transactionConstruct,
        tokenGetTokenBalances,
      })
    );
