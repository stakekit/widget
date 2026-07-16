import { Context, Effect, flow, Layer } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  type HttpClientResponse,
} from "effect/unstable/http";
import { version as widgetVersion } from "../../../package.json";
import * as BorrowApi from "../../generated/api/borrow-client";
import * as LegacyApi from "../../generated/api/legacy";
import * as YieldApi from "../../generated/api/yield";
import { WidgetBootstrapConfig } from "../config/widget-config";
import { RichErrorService } from "../errors/rich-error-service";
import { waitForDelayedApiRequests } from "./delay-api-requests";
import { handleGeoBlockResponse } from "./geo-block-state";

type ApiTransport = {
  readonly borrow: BorrowApi.BorrowApi | null;
  readonly legacy: LegacyApi.LegacyApi;
  readonly yield: YieldApi.YieldApi;
};

const inspectResponse = ({
  response,
  richErrors,
  suppressRichErrors,
}: {
  readonly response: HttpClientResponse.HttpClientResponse;
  readonly richErrors: RichErrorService["Service"];
  readonly suppressRichErrors?: boolean;
}) =>
  Effect.gen(function* () {
    yield* Effect.promise(waitForDelayedApiRequests);

    if (response.status < 400) return;

    const data = yield* Effect.orElseSucceed(response.json, () => undefined);

    handleGeoBlockResponse({ data, status: response.status });

    if (!suppressRichErrors) {
      yield* richErrors.publishResponse({
        data,
        url: response.request.url,
      });
    }
  });

const configureClient = ({
  apiKey,
  baseUrl,
  client,
  richErrors,
  suppressRichErrors,
}: {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly client: HttpClient.HttpClient;
  readonly richErrors: RichErrorService["Service"];
  readonly suppressRichErrors?: boolean;
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
      inspectResponse({ response, richErrors, suppressRichErrors })
    )
  );

const makeApiTransport = Effect.gen(function* () {
  const { api } = yield* WidgetBootstrapConfig;
  const httpClient = yield* HttpClient.HttpClient;
  const richErrors = yield* RichErrorService;
  const borrowApiUrl = api.borrowApiUrl.trim();

  return {
    borrow: borrowApiUrl
      ? BorrowApi.make(
          configureClient({
            apiKey: api.apiKey,
            baseUrl: borrowApiUrl,
            client: httpClient,
            richErrors,
          })
        )
      : null,
    legacy: LegacyApi.make(
      configureClient({
        apiKey: api.apiKey,
        baseUrl: api.baseUrl,
        client: httpClient,
        richErrors,
      })
    ),
    yield: YieldApi.make(
      configureClient({
        apiKey: api.apiKey,
        baseUrl: api.yieldsApiUrl,
        client: httpClient,
        richErrors,
      })
    ),
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
