import {
  GasModeValueDto,
  ActionRequestDto,
  actionEnter,
  TokenDto,
} from "@stakekit/api-hooks";
import { GetEitherAsyncLeft, GetEitherAsyncRight } from "../../types";
import { withRequestErrorRetry } from "../../common/utils";
import { constructTxs } from "../../common/construct-txs";
import { UseMutationResult, useMutation } from "@tanstack/react-query";
import { PropsWithChildren, createContext, useContext } from "react";
import { isAxiosError } from "axios";
import { EitherAsync, Right } from "purify-ts";
import { checkGasAmount } from "../../common/check-gas-amount";

type DataType = GetEitherAsyncRight<ReturnType<typeof fn>>;
export type ErrorType = GetEitherAsyncLeft<ReturnType<typeof fn>>;

const mutationKey = ["stake-enter"];

const StakeEnterAndTxsConstructContext = createContext<
  UseMutationResult<DataType, ErrorType, Parameters<typeof fn>[0]> | undefined
>(undefined);

export const StakeEnterAndTxsConstructProvider = ({
  children,
}: PropsWithChildren) => {
  const value = useMutation<DataType, ErrorType, Parameters<typeof fn>[0]>({
    mutationKey,
    mutationFn: async (args) => (await fn(args)).unsafeCoerce(),
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
}: {
  stakeRequestDto: ActionRequestDto;
  gasModeValue: GasModeValueDto | undefined;
  isLedgerLive: boolean;
  disableGasCheck: boolean;
  gasFeeToken: TokenDto;
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
      constructTxs({ actionDto, gasModeValue, isLedgerLive })
    )
    .chain((val) =>
      (disableGasCheck
        ? EitherAsync.liftEither(Right(null))
        : checkGasAmount({
            addressWithTokenDto: {
              address: stakeRequestDto.addresses.address,
              additionalAddresses:
                stakeRequestDto.addresses.additionalAddresses,
              network: gasFeeToken.network,
              tokenAddress: gasFeeToken.address,
            },
            transactionConstructRes: val.transactionConstructRes,
          })
      )
        .chainLeft(async (e) => Right(e))
        .map((gasCheckErr) => ({
          ...val,
          stakeEnterRes: val.mappedActionDto,
          gasCheckErr: gasCheckErr ?? null,
        }))
    );

export class StakingNotAllowedError extends Error {
  static isStakingNotAllowedErrorDto = (e: unknown) => {
    const dto = e as undefined | { type: string; code: number };

    return dto && dto.code === 422 && dto.type === "STAKING_ERROR";
  };

  constructor() {
    super("Staking not allowed, needs unstaking and trying again");
  }
}
