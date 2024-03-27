import { EitherAsync, Right } from "purify-ts";
import { getAverageGasMode } from "../../../common/get-gas-mode-value";
import { usePendingActionAndTxsConstruct } from "../../../hooks/api/use-pending-action-and-txs-construct";
import { preparePendingActionRequestDto } from "./utils";
import {
  GetEitherAsyncLeft,
  GetEitherAsyncRight,
  GetEitherRight,
} from "../../../types";
import { YieldBalanceDto } from "@stakekit/api-hooks";
import { UseMutationResult, useMutation } from "@tanstack/react-query";
import { PropsWithChildren, createContext, useContext } from "react";
import { useSettings } from "../../../providers/settings";
import { useSKWallet } from "../../../providers/sk-wallet";

const mutationKey = ["on-pending-action"];

const OnPendingActionContext = createContext<
  | UseMutationResult<
      GetEitherAsyncRight<ReturnType<typeof fn>>,
      GetEitherAsyncLeft<ReturnType<typeof fn>>,
      {
        pendingActionRequestDto: GetEitherRight<
          ReturnType<typeof preparePendingActionRequestDto>
        >;
        yieldBalance: YieldBalanceDto;
      }
    >
  | undefined
>(undefined);

export const OnPendingActionProvider = ({ children }: PropsWithChildren) => {
  const pendingActionAndTxsConstruct = usePendingActionAndTxsConstruct();

  const { disableGasCheck = false } = useSettings();

  const { isLedgerLive } = useSKWallet();

  const value = useMutation<
    GetEitherAsyncRight<ReturnType<typeof fn>>,
    GetEitherAsyncLeft<ReturnType<typeof fn>>,
    {
      pendingActionRequestDto: GetEitherRight<
        ReturnType<typeof preparePendingActionRequestDto>
      >;
      yieldBalance: YieldBalanceDto;
    }
  >({
    mutationKey,
    mutationFn: async (args) =>
      (
        await fn({
          ...args,
          pendingActionAndTxsConstruct:
            pendingActionAndTxsConstruct.mutateAsync,
          disableGasCheck,
          isLedgerLive,
        })
      ).unsafeCoerce(),
  });

  return (
    <OnPendingActionContext.Provider value={value}>
      {children}
    </OnPendingActionContext.Provider>
  );
};

export const useOnPendingAction = () => {
  const value = useContext(OnPendingActionContext);

  if (!value) {
    throw new Error(
      "useOnPendingAction must be used within a OnPendingActionProvider"
    );
  }

  return value;
};

const fn = ({
  pendingActionRequestDto,
  yieldBalance,
  pendingActionAndTxsConstruct,
  disableGasCheck,
  isLedgerLive,
}: {
  pendingActionRequestDto: GetEitherRight<
    ReturnType<typeof preparePendingActionRequestDto>
  >;
  yieldBalance: YieldBalanceDto;
  pendingActionAndTxsConstruct: ReturnType<
    typeof usePendingActionAndTxsConstruct
  >["mutateAsync"];
  disableGasCheck: boolean;
  isLedgerLive: boolean;
}) =>
  getAverageGasMode(pendingActionRequestDto.gasFeeToken.network)
    .chainLeft(async () => Right(null))
    .chain((val) =>
      EitherAsync(() =>
        pendingActionAndTxsConstruct({
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
        })
      )
        .mapLeft(() => new Error("Stake claim and txs construct failed"))
        .map((res) => ({ ...val, ...res }))
    )
    .map((val) => ({
      ...val,
      pendingActionToken: yieldBalance.token,
    }));
