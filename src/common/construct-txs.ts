import {
  ActionDto,
  GasModeValueDto,
  TokenDto,
  transactionConstruct,
} from "@stakekit/api-hooks";
import {
  getTransactionsTotalGasAmount,
  getValidStakeSessionTx,
} from "../domain";
import { EitherAsync } from "purify-ts";
import { withRequestErrorRetry } from "./utils";
import { isAxiosError } from "axios";
import { ActionDtoWithGasEstimate } from "../domain/types/action";

export const constructTxs = ({
  actionDto,
  gasModeValue,
  isLedgerLive,
  gasFeeToken,
}: {
  gasFeeToken: TokenDto;
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
    .map<ActionDtoWithGasEstimate>((constructedTxs) => ({
      ...actionDto,
      gasEstimate: {
        token: gasFeeToken,
        amount: getTransactionsTotalGasAmount(constructedTxs),
      },
    }));
