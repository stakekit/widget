import { Effect, Schema } from "effect";
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
import { requireBorrowTransport } from "./borrow-transport";
import type { ApiClients } from "./transport";

type SubmitTransactionRequest = {
  readonly command: BorrowSubmitTransactionCommand;
  readonly transactionId: string;
};

export const makeBorrowOperations = (
  borrow: ApiClients<BorrowApi.BorrowApi> | null,
  borrowEnabled: boolean,
  richErrors: RichErrorService["Service"]
) => {
  const presentRequestError = presentApiRequestError(richErrors);

  const requireTransport = Effect.fn("BorrowOperations.requireTransport")(
    function* () {
      return yield* requireBorrowTransport(borrow, borrowEnabled);
    }
  );

  const executeAction = Effect.fn("BorrowOperations.executeAction")(function* (
    command: BorrowActionCommand
  ) {
    const client = yield* requireTransport();
    return yield* client.write
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
    const response = yield* client.read
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
    return yield* client.write
      .ActionsControllerStepV1(actionId, undefined)
      .pipe(
        decodeApiResponse("borrow-action-step", BorrowAction),
        presentRequestError
      );
  });

  const sendTransaction = Effect.fn("BorrowOperations.sendTransaction")(
    function* (request: SubmitTransactionRequest) {
      const client = yield* requireTransport();
      return yield* client.write
        .TransactionsControllerSubmitTransactionV1(request.transactionId, {
          payload: request.command,
        })
        .pipe(
          decodeApiResponse(
            "borrow-transaction-submit",
            BorrowSubmitTransactionResult
          )
        );
    }
  );

  const submitTransaction = Effect.fn("BorrowOperations.submitTransaction")(
    function* (request: SubmitTransactionRequest) {
      return yield* sendTransaction(request).pipe(presentRequestError);
    }
  );

  const submitTransactionInBackground = Effect.fn(
    "BorrowOperations.submitTransactionInBackground"
  )(function* (request: SubmitTransactionRequest) {
    return yield* sendTransaction(request);
  });

  return {
    executeAction,
    getAction,
    stepAction,
    submitTransaction,
    submitTransactionInBackground,
  } as const;
};
