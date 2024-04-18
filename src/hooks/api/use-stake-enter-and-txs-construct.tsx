import type {
  GasModeValueDto,
  ActionRequestDto,
  useActionEnterHook,
  TokenDto,
  useTransactionConstructHook,
  useTokenGetTokenBalancesHook,
} from "@stakekit/api-hooks";
import { useActionGetGasEstimateHook } from "@stakekit/api-hooks";
import type { GetEitherAsyncLeft, GetEitherAsyncRight } from "../../types";
import { withRequestErrorRetry } from "../../common/utils";
import type { UseMutationResult } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { createContext, useContext } from "react";
import { isAxiosError } from "axios";
import { actionWithGasEstimateAndCheck } from "../../common/action-with-gas-estimate-and-check";
import { getValidStakeSessionTx } from "../../domain";
import { EitherAsync } from "purify-ts";

type DataType = GetEitherAsyncRight<ReturnType<typeof fn>>;
export type ErrorType = GetEitherAsyncLeft<ReturnType<typeof fn>>;

const mutationKey = ["stake-enter"];

const StakeEnterAndTxsConstructContext = createContext<
  | UseMutationResult<
      DataType,
      ErrorType,
      Omit<Parameters<typeof fn>[0], "gasEstimate">
    >
  | undefined
>(undefined);

export const StakeEnterAndTxsConstructProvider = ({
  children,
}: PropsWithChildren) => {
  const gasEstimate = useActionGetGasEstimateHook();

  const value = useMutation<
    DataType,
    ErrorType,
    Omit<Parameters<typeof fn>[0], "gasEstimate">
  >({
    mutationKey,
    mutationFn: async (args) =>
      (await fn({ ...args, gasEstimate })).unsafeCoerce(),
  });

  return (
    <StakeEnterAndTxsConstructContext.Provider value={value}>
      {children}
    </StakeEnterAndTxsConstructContext.Provider>
  );
};

export const useStakeEnterAndTxsConstruct = () => {
  const value = useContext(StakeEnterAndTxsConstructContext);

  if (value === undefined) {
    throw new Error(
      "useStakeEnterAndTxsConstruct must be used within a StakeEnterAndTxsConstructProvider"
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
  actionEnter,
  transactionConstruct,
  tokenGetTokenBalances,
  gasEstimate,
}: {
  stakeRequestDto: ActionRequestDto;
  gasModeValue: GasModeValueDto | undefined;
  isLedgerLive: boolean;
  disableGasCheck: boolean;
  gasFeeToken: TokenDto;
  actionEnter: ReturnType<typeof useActionEnterHook>;
  transactionConstruct: ReturnType<typeof useTransactionConstructHook>;
  tokenGetTokenBalances: ReturnType<typeof useTokenGetTokenBalancesHook>;
  gasEstimate: ReturnType<typeof useActionGetGasEstimateHook>;
}) =>
  withRequestErrorRetry({ fn: () => actionEnter(stakeRequestDto) })
    .mapLeft<StakingNotAllowedError | Error>((e) => {
      if (
        isAxiosError(e) &&
        StakingNotAllowedError.isStakingNotAllowedErrorDto(e.response?.data)
      ) {
        return new StakingNotAllowedError();
      }

      return new Error("Stake enter error");
    })
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
    );

class StakingNotAllowedError extends Error {
  static isStakingNotAllowedErrorDto = (e: unknown) => {
    const dto = e as undefined | { type: string; code: number };

    return dto && dto.code === 422 && dto.type === "STAKING_ERROR";
  };

  constructor() {
    super("Staking not allowed, needs unstaking and trying again");
  }
}
