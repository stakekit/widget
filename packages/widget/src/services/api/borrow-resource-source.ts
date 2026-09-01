import { Effect, Schema } from "effect";
import { BorrowFeatureDisabled } from "../../domain/borrow/availability";
import type { Integration } from "../../domain/borrow/catalog/integration";
import type { BorrowNetwork } from "../../domain/borrow/network";
import {
  BorrowIntegrationPositionsResponse,
  BorrowIntegrationsResponse,
  BorrowMarketsResponse,
} from "../../domain/borrow/responses";
import type { WalletAddress } from "../../domain/identity/identifiers";
import type * as BorrowApi from "../../generated/api/borrow-client";
import {
  decodeApiResponse,
  withApiRequestError,
  withResponseDecodeError,
} from "./api-operation";
import { MissingBorrowApiConfig } from "./resource-sources";

export const makeBorrowResourceSource = (
  borrow: BorrowApi.BorrowApi | null,
  borrowEnabled: boolean
) => {
  const requireTransport = Effect.fn("BorrowResourceSource.requireTransport")(
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

  const getIntegrations = Effect.gen(function* () {
    const client = yield* requireTransport();
    return yield* client
      .IntegrationsControllerGetIntegrationsV1(undefined)
      .pipe(
        decodeApiResponse("borrow-integrations", BorrowIntegrationsResponse)
      );
  }).pipe(Effect.withSpan("BorrowResourceSource.getIntegrations"));

  const getMarkets = Effect.fn("BorrowResourceSource.getMarkets")(
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

  const getPositionData = Effect.fn("BorrowResourceSource.getPositionData")(
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

  return { getIntegrations, getMarkets, getPositionData } as const;
};
