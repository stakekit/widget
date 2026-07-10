import { Context, Data, Effect, flow, Layer } from "effect";
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
import { handleRichErrorResponse } from "../../hooks/use-rich-errors";

type WidgetApiClientOptions = {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly borrowApiUrl: string;
  readonly yieldsApiUrl: string;
};

export type BorrowEffectClient = BorrowApi.BorrowApi;

type EffectApiClient = {
  readonly borrow: BorrowEffectClient;
  readonly borrowMutations: BorrowEffectClient;
  readonly legacy: LegacyApi.LegacyApi;
  readonly yield: YieldApi.YieldApi;
  readonly yieldMutations: YieldApi.YieldApi;
};

export class StakeKitApiService extends Context.Service<
  StakeKitApiService,
  EffectApiClient
>()("stakekit/widget/StakeKitApiService") {}

export class MissingBorrowApiConfig extends Data.TaggedError(
  "MissingBorrowApiConfig"
)<{
  readonly message: string;
}> {}

const inspectResponse = ({
  response,
  suppressRichErrors,
}: {
  readonly response: HttpClientResponse.HttpClientResponse;
  readonly suppressRichErrors?: boolean;
}) =>
  Effect.gen(function* () {
    yield* Effect.promise(waitForDelayedApiRequests);

    if (response.status < 400) {
      return;
    }

    const data = yield* Effect.orElseSucceed(response.json, () => undefined);

    handleGeoBlockResponse({
      data,
      status: response.status,
    });

    if (!suppressRichErrors) {
      handleRichErrorResponse({
        data,
        url: response.request.url,
      });
    }
  });

const configureClient = ({
  apiKey,
  baseUrl,
  client,
  retryTransient = true,
  suppressRichErrors,
}: {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly client: HttpClient.HttpClient;
  readonly suppressRichErrors?: boolean;
  readonly retryTransient?: boolean;
}): HttpClient.HttpClient => {
  const configured = client.pipe(
    HttpClient.mapRequest(
      flow(
        HttpClientRequest.prependUrl(baseUrl),
        HttpClientRequest.setHeader("X-API-KEY", apiKey),
        HttpClientRequest.acceptJson
      )
    )
  );
  const withRetry = retryTransient
    ? configured.pipe(HttpClient.retryTransient({ times: 3 }))
    : configured;

  return withRetry.pipe(
    HttpClient.tap((response) =>
      inspectResponse({ response, suppressRichErrors })
    )
  );
};

const requireBorrowApiUrl = (url: string) => {
  const trimmedUrl = url.trim();

  if (!trimmedUrl) {
    throw new MissingBorrowApiConfig({
      message: "Borrow API URL must be configured before using Borrow.",
    });
  }

  return trimmedUrl;
};

const createApiClient = ({
  apiKey,
  baseUrl,
  borrowApiUrl,
  httpClient,
  suppressRichErrors,
  yieldsApiUrl,
}: WidgetApiClientOptions & {
  readonly httpClient: HttpClient.HttpClient;
  readonly suppressRichErrors?: boolean;
}): EffectApiClient => {
  const resolvedBorrowApiUrl = requireBorrowApiUrl(borrowApiUrl);

  return {
    borrow: BorrowApi.make(
      configureClient({
        apiKey,
        baseUrl: resolvedBorrowApiUrl,
        client: httpClient,
        suppressRichErrors,
      })
    ),
    borrowMutations: BorrowApi.make(
      configureClient({
        apiKey,
        baseUrl: resolvedBorrowApiUrl,
        client: httpClient,
        suppressRichErrors,
        retryTransient: false,
      })
    ),
    legacy: LegacyApi.make(
      configureClient({
        apiKey,
        baseUrl,
        client: httpClient,
        suppressRichErrors,
      })
    ),
    yield: YieldApi.make(
      configureClient({
        apiKey,
        baseUrl: yieldsApiUrl,
        client: httpClient,
        suppressRichErrors,
      })
    ),
    yieldMutations: YieldApi.make(
      configureClient({
        apiKey,
        baseUrl: yieldsApiUrl,
        client: httpClient,
        suppressRichErrors,
        retryTransient: false,
      })
    ),
  };
};

export const makeStakeKitApiLayer = (config: WidgetApiClientOptions) =>
  Layer.effect(
    StakeKitApiService,
    Effect.gen(function* () {
      const borrowApiUrl = config.borrowApiUrl.trim();

      if (!borrowApiUrl) {
        return yield* new MissingBorrowApiConfig({
          message: "Borrow API URL must be configured before using Borrow.",
        });
      }

      const httpClient = yield* HttpClient.HttpClient;
      return StakeKitApiService.of(
        createApiClient({
          ...config,
          borrowApiUrl,
          httpClient,
        })
      );
    })
  ).pipe(Layer.provide(FetchHttpClient.layer));
