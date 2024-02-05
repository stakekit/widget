import {
  ActionDto,
  GasModeValueDto,
  transactionConstruct,
} from "@stakekit/api-hooks";
import { getValidStakeSessionTx } from "../domain";
import { EitherAsync } from "purify-ts";
import { withRequestErrorRetry } from "./utils";
import { isAxiosError } from "axios";

export const constructTxs = ({
  actionDto,
  gasModeValue,
  isLedgerLive,
}: {
  actionDto: ActionDto;
  gasModeValue: GasModeValueDto | undefined;
  isLedgerLive: boolean;
}) =>
  EitherAsync.liftEither(getValidStakeSessionTx(actionDto))
    .chain((actionWithValidTxs) =>
      EitherAsync.sequence(
        actionWithValidTxs.transactions.map((tx) =>
          withRequestErrorRetry({
            fn: () =>
              transactionConstruct(tx.id, {
                gasArgs: gasModeValue?.gasArgs,
                ledgerWalletAPICompatible: isLedgerLive,
              }),
            shouldRetry: (e, retryCount) =>
              retryCount <= 3 && isAxiosError(e) && e.response?.status === 404,
          }).mapLeft(() => new Error("Transaction construct error"))
        )
      )
    )
    .map((constructedTxs) => {
      const mapped = new Map(constructedTxs.map((val) => [val.id, val]));

      return {
        mappedActionDto: {
          ...actionDto,
          transactions: actionDto.transactions.map(
            (v) => mapped.get(v.id) ?? v
          ),
        } satisfies ActionDto,
        transactionConstructRes: constructedTxs,
      };
    });
