import { Context, Effect, flow, Layer } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { version as widgetVersion } from "../../../package.json";
import * as BorrowApi from "../../generated/api/borrow-client";
import * as LegacyApi from "../../generated/api/legacy";
import * as YieldApi from "../../generated/api/yield";
import { WidgetConfigService } from "../config/widget-config";
import { GeoBlockService } from "../geoblocking";

/**
 * Clients for one backend. Reads retry transient failures; writes are sent
 * once, because the server may already have acted on a request whose
 * response was lost. Repeating a write is the user's explicit Retry.
 */
export type ApiClients<A> = {
  readonly read: A;
  readonly write: A;
};

type ApiTransport = {
  readonly borrow: ApiClients<BorrowApi.BorrowApi> | null;
  readonly legacy: LegacyApi.LegacyApi;
  readonly yield: ApiClients<YieldApi.YieldApi>;
};

const makeApiTransport = Effect.gen(function* () {
  const widgetConfig = yield* WidgetConfigService;
  const api = yield* widgetConfig.current;
  const httpClient = yield* HttpClient.HttpClient;
  const geoBlock = yield* GeoBlockService;

  const observeGeoBlock = HttpClient.tap((response) =>
    Effect.gen(function* () {
      if (response.status < 400) return;

      const data = yield* Effect.orElseSucceed(response.json, () => undefined);

      yield* geoBlock.observeResponse({ data, status: response.status });
    })
  );

  const makeClients = (baseUrl: string): ApiClients<HttpClient.HttpClient> => {
    const client = httpClient.pipe(
      HttpClient.mapRequest(
        flow(
          HttpClientRequest.prependUrl(baseUrl),
          HttpClientRequest.setHeader("X-API-KEY", api.apiKey),
          HttpClientRequest.setHeader("X-Yield-Widget-Version", widgetVersion),
          HttpClientRequest.acceptJson
        )
      )
    );

    return {
      read: client.pipe(
        HttpClient.retryTransient({ times: 3 }),
        observeGeoBlock
      ),
      write: client.pipe(observeGeoBlock),
    };
  };

  const borrowClients = api.borrowApiUrl ? makeClients(api.borrowApiUrl) : null;
  const yieldClients = makeClients(api.yieldsApiUrl);

  return {
    borrow: borrowClients
      ? {
          read: BorrowApi.make(borrowClients.read),
          write: BorrowApi.make(borrowClients.write),
        }
      : null,
    legacy: LegacyApi.make(makeClients(api.baseUrl).read),
    yield: {
      read: YieldApi.make(yieldClients.read),
      write: YieldApi.make(yieldClients.write),
    },
  } satisfies ApiTransport;
});

export class ApiTransportService extends Context.Service<ApiTransportService>()(
  "stakekit/widget/services/api/ApiTransportService",
  {
    make: makeApiTransport,
  }
) {
  static readonly layer = Layer.effect(
    ApiTransportService,
    ApiTransportService.make
  ).pipe(Layer.provide(FetchHttpClient.layer));
}
