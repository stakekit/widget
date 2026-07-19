import { Context, Effect, Layer, Schema } from "effect";
import { Action as BorrowAction } from "../../domain/borrow/action";
import type { ActionRequest as BorrowActionRequest } from "../../domain/borrow/action-request";
import type { Integration } from "../../domain/borrow/integration";
import type { BorrowNetwork } from "../../domain/borrow/network";
import {
  BorrowIntegrationPositionsResponse,
  BorrowIntegrationsResponse,
  BorrowMarketsResponse,
} from "../../domain/borrow/responses";
import {
  type SubmitTransactionCommand as BorrowSubmitTransactionCommand,
  SubmitTransactionResult as BorrowSubmitTransactionResult,
} from "../../domain/borrow/transaction";
import { MissingBorrowApiConfig } from "../../domain/schema/api-errors";
import type { WalletAddress } from "../../domain/schema/identifiers";
import type * as BorrowApi from "../../generated/api/borrow-client";
import {
  decodeApiResponse,
  withApiRequestError,
  withResponseDecodeError,
} from "./api-operation";
import { ApiTransportService } from "./transport";

const makeBorrowApiService = (borrow: BorrowApi.BorrowApi | null) => {
  const requireTransport = Effect.fn("BorrowApiService.requireTransport")(
    function* () {
      if (borrow) return borrow;

      return yield* new MissingBorrowApiConfig({
        message: "Borrow API URL must be configured before using Borrow.",
      });
    }
  );

  const getIntegrations = Effect.fn("BorrowApiService.getIntegrations")(
    function* () {
      const client = yield* requireTransport();
      return yield* client
        .IntegrationsControllerGetIntegrationsV1(undefined)
        .pipe(
          decodeApiResponse("borrow-integrations", BorrowIntegrationsResponse)
        );
    }
  );

  const getMarkets = Effect.fn("BorrowApiService.getMarkets")(
    function* (request: {
      readonly limit: number;
      readonly network: BorrowNetwork;
      readonly offset: number;
      readonly scope: "all";
    }) {
      const client = yield* requireTransport();
      return yield* client
        .MarketsControllerGetMarketsV1({ params: request })
        .pipe(decodeApiResponse("borrow-markets", BorrowMarketsResponse));
    }
  );

  const getPositionData = Effect.fn("BorrowApiService.getPositionData")(
    function* (request: {
      readonly address: WalletAddress;
      readonly integrations: ReadonlyArray<Integration>;
      readonly network: BorrowNetwork;
    }) {
      const client = yield* requireTransport();
      const responses = yield* Effect.forEach(
        request.integrations,
        (integration) =>
          client
            .PositionsControllerGetPositionsV1({
              params: {
                address: request.address,
                integrationId: integration.id,
                network: request.network,
              },
            })
            .pipe(
              withApiRequestError("borrow-positions"),
              Effect.map((position) => ({ integration, position }))
            ),
        { concurrency: 5 }
      );

      return yield* Schema.decodeEffect(BorrowIntegrationPositionsResponse)(
        responses
      ).pipe(withResponseDecodeError("borrow-positions"));
    }
  );

  const executeAction = Effect.fn("BorrowApiService.executeAction")(function* (
    request: BorrowActionRequest
  ) {
    const client = yield* requireTransport();
    return yield* client
      .ActionsControllerExecuteActionV1({ payload: request })
      .pipe(decodeApiResponse("borrow-action-create", BorrowAction));
  });

  const getAction = Effect.fn("BorrowApiService.getAction")(function* (
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

  const stepAction = Effect.fn("BorrowApiService.stepAction")(function* (
    actionId: string
  ) {
    const client = yield* requireTransport();
    return yield* client
      .ActionsControllerStepV1(actionId, undefined)
      .pipe(decodeApiResponse("borrow-action-step", BorrowAction));
  });

  const submitTransaction = Effect.fn("BorrowApiService.submitTransaction")(
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
    getIntegrations,
    getMarkets,
    getPositionData,
    stepAction,
    submitTransaction,
  } as const;
};

export class BorrowApiService extends Context.Service<BorrowApiService>()(
  "stakekit/widget/services/api/BorrowApiService",
  {
    make: Effect.map(ApiTransportService, ({ borrow }) =>
      makeBorrowApiService(borrow)
    ),
  }
) {
  static readonly layer = Layer.effect(BorrowApiService, BorrowApiService.make);
}
