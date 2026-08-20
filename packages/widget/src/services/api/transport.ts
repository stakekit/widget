import { Context, Effect, flow, Layer } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
} from "effect/unstable/http";
import { version as widgetVersion } from "../../../package.json";
import * as BorrowApi from "../../generated/api/borrow-client";
import * as LegacyApi from "../../generated/api/legacy";
import * as YieldApi from "../../generated/api/yield";
import { WidgetConfigService } from "../config/widget-config";
import { GeoBlockService } from "../geoblocking";

type ApiTransport = {
  readonly borrow: BorrowApi.BorrowApi | null;
  readonly legacy: LegacyApi.LegacyApi;
  readonly yield: YieldApi.YieldApi;
};

const configureClient = ({
  apiKey,
  baseUrl,
  client,
  geoBlock,
}: {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly client: HttpClient.HttpClient;
  readonly geoBlock: GeoBlockService["Service"];
}): HttpClient.HttpClient =>
  client.pipe(
    HttpClient.mapRequest(
      flow(
        HttpClientRequest.prependUrl(baseUrl),
        HttpClientRequest.setHeader("X-API-KEY", apiKey),
        HttpClientRequest.setHeader("X-Yield-Widget-Version", widgetVersion),
        HttpClientRequest.acceptJson
      )
    ),
    HttpClient.retryTransient({ times: 3 }),
    HttpClient.tap((response) =>
      Effect.gen(function* () {
        if (response.status < 400) return;

        const data = yield* Effect.orElseSucceed(
          response.json,
          () => undefined
        );

        yield* geoBlock.observeResponse({ data, status: response.status });
      })
    )
  );

const makeApiTransport = Effect.gen(function* () {
  const widgetConfig = yield* WidgetConfigService;
  const api = yield* widgetConfig.current;
  const httpClient = yield* HttpClient.HttpClient;
  const geoBlock = yield* GeoBlockService;
  const makeClient = (baseUrl: string) =>
    configureClient({
      apiKey: api.apiKey,
      baseUrl,
      client: httpClient,
      geoBlock,
    });

  return {
    borrow: api.borrowApiUrl
      ? BorrowApi.make(makeClient(api.borrowApiUrl))
      : null,
    legacy: LegacyApi.make(makeClient(api.baseUrl)),
    yield: YieldApi.make(makeClient(api.yieldsApiUrl)),
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
