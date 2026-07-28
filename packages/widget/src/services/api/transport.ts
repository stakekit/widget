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
import {
  normalizeWidgetApiConfig,
  WidgetConfigService,
} from "../config/widget-config";
import { RichErrorService } from "../errors/rich-error-service";
import { handleGeoBlockResponse } from "./geo-block-state";

type ApiTransport = {
  readonly operations: {
    readonly borrow: BorrowApi.BorrowApi | null;
    readonly yield: YieldApi.YieldApi;
  };
  readonly resources: {
    readonly borrow: BorrowApi.BorrowApi | null;
    readonly legacy: LegacyApi.LegacyApi;
    readonly yield: YieldApi.YieldApi;
  };
};

const inspectResponse = ({
  response,
  richErrors,
  publishRichErrors,
}: {
  readonly response: HttpClientResponse.HttpClientResponse;
  readonly richErrors: RichErrorService["Service"];
  readonly publishRichErrors: boolean;
}) =>
  Effect.gen(function* () {
    if (response.status < 400) return;

    const data = yield* Effect.orElseSucceed(response.json, () => undefined);

    handleGeoBlockResponse({ data, status: response.status });

    if (publishRichErrors) {
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
  publishRichErrors,
  richErrors,
}: {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly client: HttpClient.HttpClient;
  readonly publishRichErrors: boolean;
  readonly richErrors: RichErrorService["Service"];
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
      inspectResponse({ response, richErrors, publishRichErrors })
    )
  );

const makeApiTransport = Effect.gen(function* () {
  const widgetConfig = yield* WidgetConfigService;
  const api = normalizeWidgetApiConfig(widgetConfig.initial);
  const httpClient = yield* HttpClient.HttpClient;
  const richErrors = yield* RichErrorService;
  const borrowApiUrl = api.borrowApiUrl.trim();
  const makeClient = ({
    baseUrl,
    publishRichErrors,
  }: {
    readonly baseUrl: string;
    readonly publishRichErrors: boolean;
  }) =>
    configureClient({
      apiKey: api.apiKey,
      baseUrl,
      client: httpClient,
      publishRichErrors,
      richErrors,
    });
  const makeBorrowClient = (publishRichErrors: boolean) =>
    borrowApiUrl
      ? BorrowApi.make(makeClient({ baseUrl: borrowApiUrl, publishRichErrors }))
      : null;

  return {
    operations: {
      borrow: makeBorrowClient(true),
      yield: YieldApi.make(
        makeClient({ baseUrl: api.yieldsApiUrl, publishRichErrors: true })
      ),
    },
    resources: {
      borrow: makeBorrowClient(false),
      legacy: LegacyApi.make(
        makeClient({ baseUrl: api.baseUrl, publishRichErrors: false })
      ),
      yield: YieldApi.make(
        makeClient({ baseUrl: api.yieldsApiUrl, publishRichErrors: false })
      ),
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
