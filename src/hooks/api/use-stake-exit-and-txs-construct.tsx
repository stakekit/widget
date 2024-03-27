import {
  GasModeValueDto,
  ActionRequestDto,
  actionExit,
  TokenDto,
} from "@stakekit/api-hooks";
import { withRequestErrorRetry } from "../../common/utils";
import { GetEitherAsyncLeft, GetEitherAsyncRight } from "../../types";
import { UseMutationResult, useMutation } from "@tanstack/react-query";
import { PropsWithChildren, createContext, useContext } from "react";
import { actionWithGasEstimateAndCheck } from "../../common/action-with-gas-estimate-and-check";
import { getValidStakeSessionTx } from "../../domain";
import { EitherAsync } from "purify-ts";

const mutationKey = ["stake-exit"];

const StakeExitAndTxsConstructContext = createContext<
  | UseMutationResult<
      GetEitherAsyncRight<ReturnType<typeof fn>>,
      GetEitherAsyncLeft<ReturnType<typeof fn>>,
      Parameters<typeof fn>[0]
    >
  | undefined
>(undefined);

export const StakeExitAndTxsConstructContextProvider = ({
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
}: {
  stakeRequestDto: ActionRequestDto;
  gasModeValue: GasModeValueDto | undefined;
  isLedgerLive: boolean;
  disableGasCheck: boolean;
  gasFeeToken: TokenDto;
}) =>
  withRequestErrorRetry({ fn: () => actionExit(stakeRequestDto) })
    .mapLeft(() => new Error("Stake exit error"))
    .chain((actionDto) =>
      EitherAsync.liftEither(getValidStakeSessionTx(actionDto))
    )
    .chain((actionDto) =>
      actionWithGasEstimateAndCheck({
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
      })
    );
