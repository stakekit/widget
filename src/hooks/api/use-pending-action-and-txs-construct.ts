import {
  GasModeValueDto,
  PendingActionRequestDto,
  actionPending,
  transactionConstruct,
} from "@stakekit/api-hooks";
import { EitherAsync } from "purify-ts";
import { useSharedMutation } from "../use-shared-mutation";
import { getValidStakeSessionTx } from "../../domain";
import { useSKWallet } from "../wallet/use-sk-wallet";
import { withRequestErrorRetry } from "../../api/utils";
import { GetEitherAsyncLeft, GetEitherAsyncRight } from "../../types";

export const usePendingActionAndTxsConstruct = () => {
  const { isLedgerLive } = useSKWallet();

  return useSharedMutation<
    GetEitherAsyncRight<ReturnType<typeof fn>>,
    GetEitherAsyncLeft<ReturnType<typeof fn>>,
    {
      pendingActionRequestDto: PendingActionRequestDto;
      gasModeValue: GasModeValueDto | undefined;
    }
  >(["pending-action"], async (args) => {
    return await fn({ ...args, isLedgerLive }).caseOf({
      Left: (e) => Promise.reject(e),
      Right: (r) => Promise.resolve(r),
    });
  });
};

const fn = ({
  gasModeValue,
  pendingActionRequestDto,
  isLedgerLive,
}: {
  pendingActionRequestDto: PendingActionRequestDto;
  gasModeValue: GasModeValueDto | undefined;
  isLedgerLive: boolean;
}) =>
  withRequestErrorRetry({
    fn: () => actionPending(pendingActionRequestDto),
  })
    .mapLeft(() => new Error("Pending actions error"))
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
        pendingActionRes: val,
        transactionConstructRes: res,
      }))
    );
