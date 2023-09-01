import {
  GasModeValueDto,
  StakeRequestDto,
  stakeExit,
  transactionConstruct,
} from "@stakekit/api-hooks";
import { EitherAsync } from "purify-ts";
import { useSharedMutation } from "../use-shared-mutation";
import { getValidStakeSessionTx } from "../../domain";
import { useSKWallet } from "../wallet/use-sk-wallet";
import { withRequestErrorRetry } from "../../api/utils";
import { GetEitherAsyncLeft, GetEitherAsyncRight } from "../../types";

export const useStakeExitAndTxsConstruct = () => {
  const { isLedgerLive } = useSKWallet();

  return useSharedMutation<
    GetEitherAsyncRight<ReturnType<typeof fn>>,
    GetEitherAsyncLeft<ReturnType<typeof fn>>,
    {
      stakeRequestDto: StakeRequestDto;
      gasModeValue: GasModeValueDto | undefined;
    }
  >(["stake-exit"], async (args) => {
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
  withRequestErrorRetry({ fn: () => stakeExit(stakeRequestDto) })
    .mapLeft(() => new Error("Stake exit error"))
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
        stakeExitRes: val,
        transactionConstructRes: res,
      }))
    );
