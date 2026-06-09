import { Effect, flow, ManagedRuntime } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  type HttpClientResponse,
} from "effect/unstable/http";
import { waitForDelayedApiRequests } from "../../common/delay-api-requests";
import * as LegacyApi from "../../generated/api/legacy";
import * as YieldApi from "../../generated/api/yield";
import { handleGeoBlockResponse } from "../../hooks/use-geo-block";
import { handleRichErrorResponse } from "../../hooks/use-rich-errors";

type WidgetApiClientOptions = {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly yieldsApiUrl: string;
};

type ApiClientOptions = {
  readonly signal?: AbortSignal;
  readonly suppressRichErrors?: boolean;
};

const runtime = ManagedRuntime.make(FetchHttpClient.layer);

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
  suppressRichErrors,
}: {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly client: HttpClient.HttpClient;
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
      inspectResponse({ response, suppressRichErrors })
    )
  );

type BoundOperation<Operation> = Operation extends (
  ...args: infer Args
) => Effect.Effect<infer A, infer _E>
  ? (...args: Args) => Promise<A>
  : never;

const bindOperation = <
  Operation extends (...args: never[]) => Effect.Effect<unknown, unknown>,
>(
  operation: Operation,
  options?: ApiClientOptions
): BoundOperation<Operation> =>
  ((...args: Parameters<Operation>) =>
    runtime.runPromise(
      operation(...args),
      options?.signal ? { signal: options.signal } : undefined
    )) as BoundOperation<Operation>;

const bindLegacyApi = ({
  api,
  options,
}: {
  readonly api: LegacyApi.LegacyApi;
  readonly options?: ApiClientOptions;
}) => ({
  TokenControllerGetTokenBalances: bindOperation(
    api.TokenControllerGetTokenBalances,
    options
  ),
  TokenControllerGetTokenPrices: bindOperation(
    api.TokenControllerGetTokenPrices,
    options
  ),
  TokenControllerGetTokens: bindOperation(
    api.TokenControllerGetTokens,
    options
  ),
  TokenControllerTokenBalancesScan: bindOperation(
    api.TokenControllerTokenBalancesScan,
    options
  ),
  TransactionControllerGetTransactionVerificationMessageForNetwork:
    bindOperation(
      api.TransactionControllerGetTransactionVerificationMessageForNetwork,
      options
    ),
  YieldControllerGetSingleYieldRewardsSummary: bindOperation(
    api.YieldControllerGetSingleYieldRewardsSummary,
    options
  ),
});

const bindYieldApi = ({
  api,
  options,
}: {
  readonly api: YieldApi.YieldApi;
  readonly options?: ApiClientOptions;
}) => ({
  ActionsControllerEnterYield: bindOperation(
    api.ActionsControllerEnterYield,
    options
  ),
  ActionsControllerExitYield: bindOperation(
    api.ActionsControllerExitYield,
    options
  ),
  ActionsControllerGetActions: bindOperation(
    api.ActionsControllerGetActions,
    options
  ),
  ActionsControllerManageYield: bindOperation(
    api.ActionsControllerManageYield,
    options
  ),
  HealthControllerHealth: bindOperation(api.HealthControllerHealth, options),
  KycControllerGetStatus: bindOperation(api.KycControllerGetStatus, options),
  NetworksControllerGetNetworks: bindOperation(
    api.NetworksControllerGetNetworks,
    options
  ),
  ProvidersControllerGetProvider: bindOperation(
    api.ProvidersControllerGetProvider,
    options
  ),
  TransactionsControllerGetTransaction: bindOperation(
    api.TransactionsControllerGetTransaction,
    options
  ),
  TransactionsControllerSubmitTransaction: bindOperation(
    api.TransactionsControllerSubmitTransaction,
    options
  ),
  TransactionsControllerSubmitTransactionHash: bindOperation(
    api.TransactionsControllerSubmitTransactionHash,
    options
  ),
  YieldsControllerGetAggregateBalances: bindOperation(
    api.YieldsControllerGetAggregateBalances,
    options
  ),
  YieldsControllerGetYields: bindOperation(
    api.YieldsControllerGetYields,
    options
  ),
  YieldsControllerGetYield: bindOperation(
    api.YieldsControllerGetYield,
    options
  ),
  YieldsControllerGetYieldRewardRateHistory: bindOperation(
    api.YieldsControllerGetYieldRewardRateHistory,
    options
  ),
  YieldsControllerGetYieldTvlHistory: bindOperation(
    api.YieldsControllerGetYieldTvlHistory,
    options
  ),
  YieldsControllerGetYieldBalances: bindOperation(
    api.YieldsControllerGetYieldBalances,
    options
  ),
  YieldsControllerGetYieldValidators: bindOperation(
    api.YieldsControllerGetYieldValidators,
    options
  ),
});

export const createApiClient = ({
  apiKey,
  baseUrl,
  yieldsApiUrl,
}: WidgetApiClientOptions) => {
  const baseClient = runtime.runSync(HttpClient.HttpClient);

  const bindApiClients = (options?: ApiClientOptions) => {
    const legacyHttpClient = configureClient({
      apiKey,
      baseUrl,
      client: baseClient,
      suppressRichErrors: options?.suppressRichErrors,
    });
    const yieldHttpClient = configureClient({
      apiKey,
      baseUrl: yieldsApiUrl,
      client: baseClient,
      suppressRichErrors: options?.suppressRichErrors,
    });
    const legacyApi = LegacyApi.make(legacyHttpClient);
    const yieldApi = YieldApi.make(yieldHttpClient);

    return {
      legacy: bindLegacyApi({ api: legacyApi, options }),
      yield: bindYieldApi({ api: yieldApi, options }),
    };
  };

  const boundClients = bindApiClients();

  return {
    ...boundClients,
    withOptions: (options: ApiClientOptions) => bindApiClients(options),
  };
};

export type ApiClient = ReturnType<typeof createApiClient>;
