import type {
  AddressesDto,
  GasModeValueDto,
  PendingActionRequestDto,
  TokenDto,
  useActionPendingHook,
  useTokenGetTokenBalancesHook,
  useTransactionConstructHook,
} from "@stakekit/api-hooks";
import { useActionGetGasEstimateHook } from "@stakekit/api-hooks";
import { withRequestErrorRetry } from "../../common/utils";
import type { GetEitherAsyncLeft, GetEitherAsyncRight } from "../../types";
import type { UseMutationResult } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { createContext, useContext } from "react";
import { actionWithGasEstimateAndCheck } from "../../common/action-with-gas-estimate-and-check";
import { EitherAsync } from "purify-ts";
import { getValidStakeSessionTx } from "../../domain";

const mutationKey = ["pending-action"];

const PendingActionAndTxsConstructContext = createContext<
  | UseMutationResult<
      GetEitherAsyncRight<ReturnType<typeof fn>>,
      GetEitherAsyncLeft<ReturnType<typeof fn>>,
      Omit<Parameters<typeof fn>[0], "gasEstimate">
    >
  | undefined
>(undefined);

export const PendingActionAndTxsConstructContextProvider = ({
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
    <PendingActionAndTxsConstructContext.Provider value={value}>
      {children}
    </PendingActionAndTxsConstructContext.Provider>
  );
};

export const usePendingActionAndTxsConstruct = () => {
  const value = useContext(PendingActionAndTxsConstructContext);

  if (!value) {
    throw new Error(
      "usePendingActionAndTxsConstruct must be used within a PendingActionAndTxsConstructContextProvider"
    );
  }

  return value;
};

const fn = ({
  gasModeValue,
  pendingActionRequestDto,
  isLedgerLive,
  disableGasCheck,
  gasFeeToken,
  actionPending,
  tokenGetTokenBalances,
  transactionConstruct,
  gasEstimate,
}: {
  pendingActionRequestDto: PendingActionRequestDto & {
    addresses: AddressesDto;
  };
  gasModeValue: GasModeValueDto | undefined;
  isLedgerLive: boolean;
  disableGasCheck: boolean;
  gasFeeToken: TokenDto;
  actionPending: ReturnType<typeof useActionPendingHook>;
  tokenGetTokenBalances: ReturnType<typeof useTokenGetTokenBalancesHook>;
  transactionConstruct: ReturnType<typeof useTransactionConstructHook>;
  gasEstimate: ReturnType<typeof useActionGetGasEstimateHook>;
}) =>
  withRequestErrorRetry({
    fn: () => actionPending(pendingActionRequestDto),
  })
    .mapLeft(() => new Error("Pending actions error"))
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
          address: pendingActionRequestDto.addresses.address,
          additionalAddresses:
            pendingActionRequestDto.addresses.additionalAddresses,
          network: gasFeeToken.network,
          tokenAddress: gasFeeToken.address,
        },
        transactionConstruct,
        tokenGetTokenBalances,
      })
    );
