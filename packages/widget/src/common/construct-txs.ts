import type {
  ActionDto,
  GasModeValueDto,
  TokenDto,
  useTransactionConstructHook,
} from "@stakekit/api-hooks";
import { isAxiosError } from "axios";
import { EitherAsync } from "purify-ts";
import {
  getTransactionsTotalGasAmount,
  getValidStakeSessionTx,
} from "../domain";
import type { ActionDtoWithGasEstimate } from "../domain/types/action";
import { withRequestErrorRetry } from "./utils";

export const constructTxs = ({
  actionDto,
  gasModeValue,
  isLedgerLive,
  transactionConstruct,
  gasFeeToken,
}: {
  gasFeeToken: TokenDto;
  actionDto: ActionDto;
  gasModeValue: GasModeValueDto | undefined;
  isLedgerLive: boolean;
  transactionConstruct: ReturnType<typeof useTransactionConstructHook>;
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
    .map<ActionDtoWithGasEstimate>((constructedTxs) => ({
      ...actionDto,
      gasEstimate: {
        token: gasFeeToken,
        amount: getTransactionsTotalGasAmount(constructedTxs),
      },
    }));
