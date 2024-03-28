import {
  AddressesDto,
  GasModeValueDto,
  PendingActionRequestDto,
  TokenDto,
  useActionPendingHook,
  useTokenGetTokenBalancesHook,
  useTransactionConstructHook,
} from "@stakekit/api-hooks";
import { withRequestErrorRetry } from "../../common/utils";
import { GetEitherAsyncLeft, GetEitherAsyncRight } from "../../types";
import { UseMutationResult, useMutation } from "@tanstack/react-query";
import { PropsWithChildren, createContext, useContext } from "react";
import { actionWithGasEstimateAndCheck } from "../../common/action-with-gas-estimate-and-check";
import { EitherAsync } from "purify-ts";
import { getValidStakeSessionTx } from "../../domain";
import { useApiClient } from "../../providers/api/api-client-provider";

const mutationKey = ["pending-action"];

const PendingActionAndTxsConstructContext = createContext<
  | UseMutationResult<
      GetEitherAsyncRight<ReturnType<typeof fn>>,
      GetEitherAsyncLeft<ReturnType<typeof fn>>,
      Omit<Parameters<typeof fn>[0], "apiClient">
    >
  | undefined
>(undefined);

export const PendingActionAndTxsConstructContextProvider = ({
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
  apiClient,
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
  apiClient: ReturnType<typeof useApiClient>;
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
        apiClient,
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
