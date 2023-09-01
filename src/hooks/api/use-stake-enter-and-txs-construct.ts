import {
  GasModeValueDto,
  StakeRequestDto,
  stakeEnter,
  transactionConstruct,
} from "@stakekit/api-hooks";
import { EitherAsync } from "purify-ts";
import { useSharedMutation } from "../use-shared-mutation";
import { getValidStakeSessionTx } from "../../domain";
import { useSKWallet } from "../wallet/use-sk-wallet";
import { GetEitherAsyncLeft, GetEitherAsyncRight } from "../../types";
import { withRequestErrorRetry } from "../../api/utils";

export const useStakeEnterAndTxsConstruct = () => {
  const { isLedgerLive } = useSKWallet();

  return useSharedMutation<
    GetEitherAsyncRight<ReturnType<typeof fn>>,
    GetEitherAsyncLeft<ReturnType<typeof fn>>,
    {
      stakeRequestDto: StakeRequestDto;
      gasModeValue: GasModeValueDto | undefined;
    }
  >(["stake-enter"], async (args) => {
    return await fn({ ...args, isLedgerLive }).caseOf({
      Left: (e) => Promise.reject(e),
      Right: (r) => Promise.resolve(r),
    });
  });
};

const fn = ({
  gasModeValue,
  stakeRequestDto,
  isLedgerLive,
}: {
  stakeRequestDto: StakeRequestDto;
  gasModeValue: GasModeValueDto | undefined;
  isLedgerLive: boolean;
}) =>
  withRequestErrorRetry({ fn: () => stakeEnter(stakeRequestDto) })
    .mapLeft(() => new Error("Stake enter error"))
    .chain((val) => EitherAsync.liftEither(getValidStakeSessionTx(val)))
    .chain((val) =>
      EitherAsync.sequence(
        val.transactions.map((tx) =>
          withRequestErrorRetry({
            fn: () =>
              transactionConstruct(tx.id, {
                gasArgs: gasModeValue?.gasArgs,
                // @ts-expect-error
                ledgerWalletAPICompatible: isLedgerLive,
              }),
          }).mapLeft(() => new Error("Transaction construct error"))
        )
      ).map((res) => ({
        stakeEnterRes: val,
        transactionConstructRes: res,
      }))
    );
