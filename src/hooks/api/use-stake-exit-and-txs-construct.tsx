import type {
  GasModeValueDto,
  ActionRequestDto,
  useActionExitHook,
  TokenDto,
  useTransactionConstructHook,
  useTokenGetTokenBalancesHook,
  YieldDto,
} from "@stakekit/api-hooks";
import { useActionGetGasEstimateHook } from "@stakekit/api-hooks";
import { withRequestErrorRetry } from "../../common/utils";
import type { GetEitherAsyncLeft, GetEitherAsyncRight } from "../../types";
import type { UseMutationResult } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { createContext, useContext } from "react";
import { actionWithGasEstimateAndCheck } from "../../common/action-with-gas-estimate-and-check";
import { getValidStakeSessionTx } from "../../domain";
import { EitherAsync } from "purify-ts";

const mutationKey = ["stake-exit"];

const StakeExitAndTxsConstructContext = createContext<
  | UseMutationResult<
      GetEitherAsyncRight<ReturnType<typeof fn>>,
      GetEitherAsyncLeft<ReturnType<typeof fn>>,
      Omit<Parameters<typeof fn>[0], "gasEstimate">
    >
  | undefined
>(undefined);

export const StakeExitAndTxsConstructContextProvider = ({
  children,
}: PropsWithChildren) => {
  const gasEstimate = useActionGetGasEstimateHook();

  const value = useMutation<
    GetEitherAsyncRight<ReturnType<typeof fn>>,
    GetEitherAsyncLeft<ReturnType<typeof fn>>,
    Omit<Parameters<typeof fn>[0], "gasEstimate">
  >({
    mutationKey,
    mutationFn: async (args) =>
      (await fn({ ...args, gasEstimate })).unsafeCoerce(),
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
  gasEstimate,
  stakeExitData,
}: {
  stakeRequestDto: ActionRequestDto;
  gasModeValue: GasModeValueDto | undefined;
  isLedgerLive: boolean;
  disableGasCheck: boolean;
  gasFeeToken: TokenDto;
  actionExit: ReturnType<typeof useActionExitHook>;
  transactionConstruct: ReturnType<typeof useTransactionConstructHook>;
  tokenGetTokenBalances: ReturnType<typeof useTokenGetTokenBalancesHook>;
  gasEstimate: ReturnType<typeof useActionGetGasEstimateHook>;
  stakeExitData: {
    integrationData: YieldDto;
    interactedToken: TokenDto;
  };
}) =>
  withRequestErrorRetry({ fn: () => actionExit(stakeRequestDto) })
    .mapLeft(() => new Error("Stake exit error"))
    .chain((actionDto) =>
      EitherAsync.liftEither(getValidStakeSessionTx(actionDto))
    )
    .chain((actionDto) =>
      actionWithGasEstimateAndCheck({
        gasEstimate,
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
    )
    .map((val) => ({ ...val, stakeExitData }));
