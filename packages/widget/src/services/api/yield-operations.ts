import { Context, Effect, Layer } from "effect";
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
import { decodeApiResponse, encodeApiRequest } from "./api-operation";
import { ApiTransportService } from "./transport";

export type ActionPreviewRequest =
  | {
      readonly intent: "enter" | "exit";
      readonly command: ActionCommand;
    }
  | {
      readonly intent: "manage";
      readonly command: ManageActionCommand;
    };

export const makeYieldOperations = (yieldApi: YieldApi.YieldApi) => {
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
          .pipe(decodeApiResponse("action-enter-preview", YieldAction));
      }
      case "exit": {
        const payload = yield* encodeApiRequest(
          "action-exit-request",
          ActionCommand
        )(request.command);
        return yield* yieldApi
          .ActionsControllerExitYield({ payload })
          .pipe(decodeApiResponse("action-exit-preview", YieldAction));
      }
      case "manage": {
        const payload = yield* encodeApiRequest(
          "action-manage-request",
          ManageActionCommand
        )(request.command);
        return yield* yieldApi
          .ActionsControllerManageYield({ payload })
          .pipe(decodeApiResponse("action-manage-preview", YieldAction));
      }
    }
  });

  const getTransactionStatus = Effect.fn(
    "YieldOperations.getTransactionStatus"
  )(function* (command: TransactionStatusCommand) {
    return yield* yieldApi
      .TransactionsControllerGetTransaction(command.transactionId, undefined)
      .pipe(decodeApiResponse("get-transaction-status", ActionTransaction));
  });

  const submitTransactionHash = Effect.fn(
    "YieldOperations.submitTransactionHash"
  )(function* (command: SubmitTransactionHashCommand) {
    return yield* yieldApi
      .TransactionsControllerSubmitTransactionHash(command.transactionId, {
        payload: command.payload,
      })
      .pipe(decodeApiResponse("submit-transaction-hash", ActionTransaction));
  });

  const submitSignedTransaction = Effect.fn(
    "YieldOperations.submitSignedTransaction"
  )(function* (command: SubmitSignedTransactionCommand) {
    return yield* yieldApi
      .TransactionsControllerSubmitTransaction(command.transactionId, {
        payload: command.payload,
      })
      .pipe(decodeApiResponse("submit-signed-transaction", ActionTransaction));
  });

  return {
    getTransactionStatus,
    previewAction,
    submitSignedTransaction,
    submitTransactionHash,
  } as const;
};

export class YieldOperations extends Context.Service<YieldOperations>()(
  "stakekit/widget/services/api/YieldOperations",
  {
    make: Effect.map(ApiTransportService, ({ operations }) =>
      makeYieldOperations(operations.yield)
    ),
  }
) {
  static readonly layer = Layer.effect(YieldOperations, YieldOperations.make);
}
