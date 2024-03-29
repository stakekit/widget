import {
  GasModeValueDto,
  ActionRequestDto,
  actionExit,
} from "@stakekit/api-hooks";
import { withRequestErrorRetry } from "../../common/utils";
import { GetEitherAsyncLeft, GetEitherAsyncRight } from "../../types";
import { useSKWallet } from "../../providers/sk-wallet";
import { constructTxs } from "../../common/construct-txs";
import { UseMutationResult, useMutation } from "@tanstack/react-query";
import { PropsWithChildren, createContext, useContext } from "react";

const mutationKey = ["stake-exit"];

const StakeExitAndTxsConstructContext = createContext<
  | UseMutationResult<
      GetEitherAsyncRight<ReturnType<typeof fn>>,
      GetEitherAsyncLeft<ReturnType<typeof fn>>,
      {
        stakeRequestDto: ActionRequestDto;
        gasModeValue: GasModeValueDto | undefined;
      }
    >
  | undefined
>(undefined);

export const StakeExitAndTxsConstructContextProvider = ({
  children,
}: PropsWithChildren) => {
  const { isLedgerLive } = useSKWallet();

  const value = useMutation<
    GetEitherAsyncRight<ReturnType<typeof fn>>,
    GetEitherAsyncLeft<ReturnType<typeof fn>>,
    {
      stakeRequestDto: ActionRequestDto;
      gasModeValue: GasModeValueDto | undefined;
    }
  >({
    mutationKey,
    mutationFn: async (args) =>
      (await fn({ ...args, isLedgerLive })).unsafeCoerce(),
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
}: {
  stakeRequestDto: ActionRequestDto;
  gasModeValue: GasModeValueDto | undefined;
  isLedgerLive: boolean;
}) =>
  withRequestErrorRetry({ fn: () => actionExit(stakeRequestDto) })
    .mapLeft(() => new Error("Stake exit error"))
    .chain((actionDto) =>
      constructTxs({ actionDto, gasModeValue, isLedgerLive })
    )
    .map((val) => ({ ...val, stakeExitRes: val.mappedActionDto }));
