import { Context, Effect, Layer, Schema } from "effect";
import { Action as BorrowAction } from "../../domain/borrow/action";
import type { ActionCommand as BorrowActionCommand } from "../../domain/borrow/action-command";
import { BorrowFeatureDisabled } from "../../domain/borrow/availability";
import {
  type SubmitTransactionCommand as BorrowSubmitTransactionCommand,
  SubmitTransactionResult as BorrowSubmitTransactionResult,
} from "../../domain/borrow/transaction";
import { MissingBorrowApiConfig } from "../../domain/schema/api-errors";
import type * as BorrowApi from "../../generated/api/borrow-client";
import { WidgetConfigService } from "../config/widget-config";
import {
  decodeApiResponse,
  withApiRequestError,
  withResponseDecodeError,
} from "./api-operation";
import { ApiTransportService } from "./transport";

export const makeBorrowOperations = (
  borrow: BorrowApi.BorrowApi | null,
  borrowEnabled = true
) => {
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
      .pipe(decodeApiResponse("borrow-action-create", BorrowAction));
  });

  const getAction = Effect.fn("BorrowOperations.getAction")(function* (
    actionId: string
  ) {
    const client = yield* requireTransport();
    const response = yield* client
      .ActionsControllerGetActionV1(actionId, undefined)
      .pipe(withApiRequestError("borrow-action-status"));

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
      .pipe(decodeApiResponse("borrow-action-step", BorrowAction));
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
          )
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

export class BorrowOperations extends Context.Service<BorrowOperations>()(
  "stakekit/widget/services/api/BorrowOperations",
  {
    make: Effect.gen(function* () {
      const { operations } = yield* ApiTransportService;
      const widgetConfig = yield* WidgetConfigService;

      return makeBorrowOperations(
        operations.borrow,
        widgetConfig.initial.borrowEnabled
      );
    }),
  }
) {
  static readonly layer = Layer.effect(BorrowOperations, BorrowOperations.make);
}
