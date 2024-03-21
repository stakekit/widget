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
import { constructTxs } from "../../common/construct-txs";
import { UseMutationResult, useMutation } from "@tanstack/react-query";
import { PropsWithChildren, createContext, useContext } from "react";
import { EitherAsync, Right } from "purify-ts";
import { checkGasAmount } from "../../common/check-gas-amount";

const mutationKey = ["pending-action"];

const PendingActionAndTxsConstructContext = createContext<
  | UseMutationResult<
      GetEitherAsyncRight<ReturnType<typeof fn>>,
      GetEitherAsyncLeft<ReturnType<typeof fn>>,
      Parameters<typeof fn>[0]
    >
  | undefined
>(undefined);

export const PendingActionAndTxsConstructContextProvider = ({
  children,
}: PropsWithChildren) => {
  const value = useMutation<
    GetEitherAsyncRight<ReturnType<typeof fn>>,
    GetEitherAsyncLeft<ReturnType<typeof fn>>,
    Parameters<typeof fn>[0]
  >({
    mutationKey,
    mutationFn: async (args) => (await fn(args)).unsafeCoerce(),
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
}) =>
  withRequestErrorRetry({
    fn: () => actionPending(pendingActionRequestDto),
  })
    .mapLeft(() => new Error("Pending actions error"))
    .chain((actionDto) =>
      constructTxs({
        actionDto,
        gasModeValue,
        isLedgerLive,
        transactionConstruct,
      })
    )
    .chain((val) =>
      (disableGasCheck
        ? EitherAsync.liftEither(Right(null))
        : checkGasAmount({
            tokenGetTokenBalances,
            addressWithTokenDto: {
              address: pendingActionRequestDto.addresses.address,
              additionalAddresses:
                pendingActionRequestDto.addresses.additionalAddresses,
              network: gasFeeToken.network,
              tokenAddress: gasFeeToken.address,
            },
            transactionConstructRes: val.transactionConstructRes,
          })
      )
        .chainLeft(async (e) => Right(e))
        .map((gasCheckErr) => ({
          ...val,
          pendingActionRes: val.mappedActionDto,
          gasCheckErr: gasCheckErr ?? null,
        }))
    );
