import { Effect } from "effect";
import {
  ActionCommand,
  ActionTransactionReceipt,
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
import type { ApiClients } from "./transport";

export const makeYieldOperations = (
  yieldApi: ApiClients<YieldApi.YieldApi>,
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
        return yield* yieldApi.write
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
        return yield* yieldApi.write
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
        return yield* yieldApi.write
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
    return yield* yieldApi.read
      .TransactionsControllerGetTransaction(command.transactionId, undefined)
      .pipe(
        decodeApiResponse("get-transaction-status", ActionTransactionReceipt),
        presentRequestError
      );
  });

  const sendTransactionHash = (command: SubmitTransactionHashCommand) =>
    yieldApi.write
      .TransactionsControllerSubmitTransactionHash(command.transactionId, {
        payload: command.payload,
      })
      .pipe(
        decodeApiResponse("submit-transaction-hash", ActionTransactionReceipt)
      );

  const submitTransactionHash = Effect.fn(
    "YieldOperations.submitTransactionHash"
  )(function* (command: SubmitTransactionHashCommand) {
    return yield* sendTransactionHash(command).pipe(presentRequestError);
  });

  const submitTransactionHashInBackground = Effect.fn(
    "YieldOperations.submitTransactionHashInBackground"
  )(function* (command: SubmitTransactionHashCommand) {
    return yield* sendTransactionHash(command);
  });

  const submitSignedTransaction = Effect.fn(
    "YieldOperations.submitSignedTransaction"
  )(function* (command: SubmitSignedTransactionCommand) {
    return yield* yieldApi.write
      .TransactionsControllerSubmitTransaction(command.transactionId, {
        payload: command.payload,
      })
      .pipe(
        decodeApiResponse(
          "submit-signed-transaction",
          ActionTransactionReceipt
        ),
        presentRequestError
      );
  });

  return {
    getTransactionStatus,
    previewAction,
    submitSignedTransaction,
    submitTransactionHash,
    submitTransactionHashInBackground,
  } as const;
};
