import { Effect, Schema } from "effect";
import { BorrowFeatureDisabled } from "../../domain/borrow/availability";
import { Action as BorrowAction } from "../../domain/borrow/execution/action";
import type { ActionCommand as BorrowActionCommand } from "../../domain/borrow/execution/action-command";
import {
  type SubmitTransactionCommand as BorrowSubmitTransactionCommand,
  SubmitTransactionResult as BorrowSubmitTransactionResult,
} from "../../domain/borrow/execution/transaction";
import type * as BorrowApi from "../../generated/api/borrow-client";
import type { RichErrorService } from "../errors/rich-error-service";
import {
  decodeApiResponse,
  presentApiRequestError,
  withApiRequestError,
  withResponseDecodeError,
} from "./api-operation";
import { MissingBorrowApiConfig } from "./resource-sources";

export const makeBorrowOperations = (
  borrow: BorrowApi.BorrowApi | null,
  borrowEnabled: boolean,
  richErrors: RichErrorService["Service"]
) => {
  const presentRequestError = presentApiRequestError(richErrors);

  const requireTransport = Effect.fn("BorrowOperations.requireTransport")(
    function* () {
      if (!borrowEnabled) {
        return yield* new BorrowFeatureDisabled({
          message: "Borrow is disabled by Widget configuration.",
        });
      }

      if (borrow) return borrow;

      return yield* new MissingBorrowApiConfig({
        message: "Borrow API URL must be configured before using Borrow.",
      });
    }
  );

  const executeAction = Effect.fn("BorrowOperations.executeAction")(function* (
    command: BorrowActionCommand
  ) {
    const client = yield* requireTransport();
    return yield* client
      .ActionsControllerExecuteActionV1({ payload: command })
      .pipe(
        decodeApiResponse("borrow-action-create", BorrowAction),
        presentRequestError
      );
  });

  const getAction = Effect.fn("BorrowOperations.getAction")(function* (
    actionId: string
  ) {
    const client = yield* requireTransport();
    const response = yield* client
      .ActionsControllerGetActionV1(actionId, undefined)
      .pipe(withApiRequestError("borrow-action-status"), presentRequestError);

    if (!response) return null;

    return yield* Schema.decodeUnknownEffect(BorrowAction)(response).pipe(
      withResponseDecodeError("borrow-action-status")
    );
  });

  const stepAction = Effect.fn("BorrowOperations.stepAction")(function* (
    actionId: string
  ) {
    const client = yield* requireTransport();
    return yield* client
      .ActionsControllerStepV1(actionId, undefined)
      .pipe(
        decodeApiResponse("borrow-action-step", BorrowAction),
        presentRequestError
      );
  });

  const submitTransaction = Effect.fn("BorrowOperations.submitTransaction")(
    function* (request: {
      readonly command: BorrowSubmitTransactionCommand;
      readonly transactionId: string;
    }) {
      const client = yield* requireTransport();
      return yield* client
        .TransactionsControllerSubmitTransactionV1(request.transactionId, {
          payload: request.command,
        })
        .pipe(
          decodeApiResponse(
            "borrow-transaction-submit",
            BorrowSubmitTransactionResult
          ),
          presentRequestError
        );
    }
  );

  return {
    executeAction,
    getAction,
    stepAction,
    submitTransaction,
  } as const;
};
