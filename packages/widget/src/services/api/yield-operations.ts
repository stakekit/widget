import { Effect } from "effect";
import {
  ActionCommand,
  ActionTransaction,
  ManageActionCommand,
  type SubmitSignedTransactionCommand,
  type SubmitTransactionHashCommand,
  type TransactionStatusCommand,
  YieldAction,
} from "../../domain/action/models";
import type * as YieldApi from "../../generated/api/yield";
import type { RichErrorService } from "../errors/rich-error-service";
import {
  decodeApiResponse,
  encodeApiRequest,
  presentApiRequestError,
} from "./api-operation";
import type { ActionPreviewRequest } from "./operations";

export const makeYieldOperations = (
  yieldApi: YieldApi.YieldApi,
  richErrors: RichErrorService["Service"]
) => {
  const presentRequestError = presentApiRequestError(richErrors);

  const previewAction = Effect.fn("YieldOperations.previewAction")(function* (
    request: ActionPreviewRequest
  ) {
    switch (request.intent) {
      case "enter": {
        const payload = yield* encodeApiRequest(
          "action-enter-request",
          ActionCommand
        )(request.command);
        return yield* yieldApi
          .ActionsControllerEnterYield({ payload })
          .pipe(
            decodeApiResponse("action-enter-preview", YieldAction),
            presentRequestError
          );
      }
      case "exit": {
        const payload = yield* encodeApiRequest(
          "action-exit-request",
          ActionCommand
        )(request.command);
        return yield* yieldApi
          .ActionsControllerExitYield({ payload })
          .pipe(
            decodeApiResponse("action-exit-preview", YieldAction),
            presentRequestError
          );
      }
      case "manage": {
        const payload = yield* encodeApiRequest(
          "action-manage-request",
          ManageActionCommand
        )(request.command);
        return yield* yieldApi
          .ActionsControllerManageYield({ payload })
          .pipe(
            decodeApiResponse("action-manage-preview", YieldAction),
            presentRequestError
          );
      }
    }
  });

  const getTransactionStatus = Effect.fn(
    "YieldOperations.getTransactionStatus"
  )(function* (command: TransactionStatusCommand) {
    return yield* yieldApi
      .TransactionsControllerGetTransaction(command.transactionId, undefined)
      .pipe(
        decodeApiResponse("get-transaction-status", ActionTransaction),
        presentRequestError
      );
  });

  const submitTransactionHash = Effect.fn(
    "YieldOperations.submitTransactionHash"
  )(function* (command: SubmitTransactionHashCommand) {
    return yield* yieldApi
      .TransactionsControllerSubmitTransactionHash(command.transactionId, {
        payload: command.payload,
      })
      .pipe(
        decodeApiResponse("submit-transaction-hash", ActionTransaction),
        presentRequestError
      );
  });

  const submitSignedTransaction = Effect.fn(
    "YieldOperations.submitSignedTransaction"
  )(function* (command: SubmitSignedTransactionCommand) {
    return yield* yieldApi
      .TransactionsControllerSubmitTransaction(command.transactionId, {
        payload: command.payload,
      })
      .pipe(
        decodeApiResponse("submit-signed-transaction", ActionTransaction),
        presentRequestError
      );
  });

  return {
    getTransactionStatus,
    previewAction,
    submitSignedTransaction,
    submitTransactionHash,
  } as const;
};
