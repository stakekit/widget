import { Context, Effect, flow, Layer } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  type HttpClientResponse,
} from "effect/unstable/http";
import { waitForDelayedApiRequests } from "../../common/delay-api-requests";
import * as BorrowApi from "../../generated/api/borrow-client";
import * as LegacyApi from "../../generated/api/legacy";
import * as YieldApi from "../../generated/api/yield";
import { handleGeoBlockResponse } from "../../hooks/use-geo-block";
import { WidgetBootstrapConfig } from "../effect-atom-runtime/bootstrap-config";
import { RichErrorService } from "../rich-error/service";
import { makeBorrowApiService } from "./borrow-api-service";
import { makeLegacyApiService } from "./legacy-api-service";
import { makeYieldApiService } from "./yield-api-service";

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

export class StakeKitApiService extends Context.Service<StakeKitApiService>()(
  "stakekit/widget/StakeKitApiService",
  {
    make: Effect.gen(function* () {
      const transport = yield* makeApiTransport;

      return {
        borrow: makeBorrowApiService(transport.borrow),
        legacy: makeLegacyApiService(transport.legacy),
        yield: makeYieldApiService(transport.yield),
      } as const;
    }),
  }
) {
  static readonly layer = Layer.effect(
    StakeKitApiService,
    StakeKitApiService.make
  ).pipe(Layer.provide(FetchHttpClient.layer));
}
