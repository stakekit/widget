import { makeStrictApiMutation } from "../../atoms/mutation";
import {
  ActionTransaction,
  type SubmitSignedTransactionCommand,
  type SubmitTransactionHashCommand,
  type TransactionStatusCommand,
} from "../../domain/schema/action-models";
import { StakeKitApiService } from "../../providers/api/api-client";
import { stakeKitApiRuntime } from "../../providers/effect-atom-runtime/stakekit-api-service";

export const submitTransactionHashAtom = makeStrictApiMutation(
  stakeKitApiRuntime,
  {
    operation: "submit-transaction-hash",
    responseSchema: ActionTransaction,
    execute: (command: SubmitTransactionHashCommand) =>
      StakeKitApiService.use((api) =>
        api.yieldMutations.TransactionsControllerSubmitTransactionHash(
          command.transactionId,
          { payload: command.payload }
        )
      ),
  }
);

export const submitSignedTransactionAtom = makeStrictApiMutation(
  stakeKitApiRuntime,
  {
    operation: "submit-signed-transaction",
    responseSchema: ActionTransaction,
    execute: (command: SubmitSignedTransactionCommand) =>
      StakeKitApiService.use((api) =>
        api.yieldMutations.TransactionsControllerSubmitTransaction(
          command.transactionId,
          { payload: command.payload }
        )
      ),
  }
);

export const getTransactionStatusAtom = makeStrictApiMutation(
  stakeKitApiRuntime,
  {
    operation: "get-transaction-status",
    responseSchema: ActionTransaction,
    execute: (command: TransactionStatusCommand) =>
      StakeKitApiService.use((api) =>
        api.yield.TransactionsControllerGetTransaction(
          command.transactionId,
          undefined
        )
      ),
  }
);
