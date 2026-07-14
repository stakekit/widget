import { Effect, Schema } from "effect";
import {
  Action as BorrowAction,
  type ActionRequest as BorrowActionRequest,
  BorrowIntegrationPositionsResponse,
  BorrowIntegrationsResponse,
  BorrowMarketsResponse,
  type BorrowNetwork,
  type SubmitTransactionCommand as BorrowSubmitTransactionCommand,
  SubmitTransactionResult as BorrowSubmitTransactionResult,
  type Integration,
} from "../../borrow/domain";
import { MissingBorrowApiConfig } from "../../domain/schema/api-errors";
import type { WalletAddress } from "../../domain/schema/identifiers";
import type * as BorrowApi from "../../generated/api/borrow-client";
import {
  decodeApiResponse,
  withApiRequestError,
  withResponseDecodeError,
} from "./api-operation";

export const makeBorrowApiService = (borrow: BorrowApi.BorrowApi | null) => {
  const requireTransport = Effect.fn(
    "StakeKitApiService.borrow.requireTransport"
  )(function* () {
    if (borrow) return borrow;

    return yield* new MissingBorrowApiConfig({
      message: "Borrow API URL must be configured before using Borrow.",
    });
  });

  const getIntegrations = Effect.fn(
    "StakeKitApiService.borrow.getIntegrations"
  )(function* () {
    const client = yield* requireTransport();
    return yield* client
      .IntegrationsControllerGetIntegrationsV1(undefined)
      .pipe(
        decodeApiResponse("borrow-integrations", BorrowIntegrationsResponse)
      );
  });

  const getMarkets = Effect.fn("StakeKitApiService.borrow.getMarkets")(
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

  const getPositionData = Effect.fn(
    "StakeKitApiService.borrow.getPositionData"
  )(function* (request: {
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
  });

  const executeAction = Effect.fn("StakeKitApiService.borrow.executeAction")(
    function* (request: BorrowActionRequest) {
      const client = yield* requireTransport();
      return yield* client
        .ActionsControllerExecuteActionV1({ payload: request })
        .pipe(decodeApiResponse("borrow-action-create", BorrowAction));
    }
  );

  const getAction = Effect.fn("StakeKitApiService.borrow.getAction")(function* (
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

  const stepAction = Effect.fn("StakeKitApiService.borrow.stepAction")(
    function* (actionId: string) {
      const client = yield* requireTransport();
      return yield* client
        .ActionsControllerStepV1(actionId, undefined)
        .pipe(decodeApiResponse("borrow-action-step", BorrowAction));
    }
  );

  const submitTransaction = Effect.fn(
    "StakeKitApiService.borrow.submitTransaction"
  )(function* (request: {
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
  });

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
