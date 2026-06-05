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

type RunOptions = {
  readonly signal?: AbortSignal;
};

const runtime = ManagedRuntime.make(FetchHttpClient.layer);

const inspectResponse = ({
  response,
}: {
  readonly response: HttpClientResponse.HttpClientResponse;
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
    handleRichErrorResponse({
      data,
      url: response.request.url,
    });
  });

const configureClient = ({
  apiKey,
  baseUrl,
  client,
}: {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly client: HttpClient.HttpClient;
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
    HttpClient.tap((response) => inspectResponse({ response }))
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
  runOptions?: RunOptions
): BoundOperation<Operation> =>
  ((...args: Parameters<Operation>) =>
    runtime.runPromise(
      operation(...args),
      runOptions
    )) as BoundOperation<Operation>;

const bindLegacyApi = ({
  api,
  runOptions,
}: {
  readonly api: LegacyApi.LegacyApi;
  readonly runOptions?: RunOptions;
}) => ({
  TokenControllerGetTokenBalances: bindOperation(
    api.TokenControllerGetTokenBalances,
    runOptions
  ),
  TokenControllerGetTokenPrices: bindOperation(
    api.TokenControllerGetTokenPrices,
    runOptions
  ),
  TokenControllerGetTokens: bindOperation(
    api.TokenControllerGetTokens,
    runOptions
  ),
  TokenControllerTokenBalancesScan: bindOperation(
    api.TokenControllerTokenBalancesScan,
    runOptions
  ),
  TransactionControllerGetTransactionVerificationMessageForNetwork:
    bindOperation(
      api.TransactionControllerGetTransactionVerificationMessageForNetwork,
      runOptions
    ),
  YieldControllerGetSingleYieldRewardsSummary: bindOperation(
    api.YieldControllerGetSingleYieldRewardsSummary,
    runOptions
  ),
  YieldControllerYieldOpportunity: bindOperation(
    api.YieldControllerYieldOpportunity,
    runOptions
  ),
});

const bindYieldApi = ({
  api,
  runOptions,
}: {
  readonly api: YieldApi.YieldApi;
  readonly runOptions?: RunOptions;
}) => ({
  ActionsControllerEnterYield: bindOperation(
    api.ActionsControllerEnterYield,
    runOptions
  ),
  ActionsControllerExitYield: bindOperation(
    api.ActionsControllerExitYield,
    runOptions
  ),
  ActionsControllerGetActions: bindOperation(
    api.ActionsControllerGetActions,
    runOptions
  ),
  ActionsControllerManageYield: bindOperation(
    api.ActionsControllerManageYield,
    runOptions
  ),
  HealthControllerHealth: bindOperation(api.HealthControllerHealth, runOptions),
  NetworksControllerGetNetworks: bindOperation(
    api.NetworksControllerGetNetworks,
    runOptions
  ),
  TransactionsControllerGetTransaction: bindOperation(
    api.TransactionsControllerGetTransaction,
    runOptions
  ),
  TransactionsControllerSubmitTransaction: bindOperation(
    api.TransactionsControllerSubmitTransaction,
    runOptions
  ),
  TransactionsControllerSubmitTransactionHash: bindOperation(
    api.TransactionsControllerSubmitTransactionHash,
    runOptions
  ),
  YieldsControllerGetAggregateBalances: bindOperation(
    api.YieldsControllerGetAggregateBalances,
    runOptions
  ),
  YieldsControllerGetYield: bindOperation(
    api.YieldsControllerGetYield,
    runOptions
  ),
  YieldsControllerGetYieldRewardRateHistory: bindOperation(
    api.YieldsControllerGetYieldRewardRateHistory,
    runOptions
  ),
  YieldsControllerGetYieldTvlHistory: bindOperation(
    api.YieldsControllerGetYieldTvlHistory,
    runOptions
  ),
  YieldsControllerGetYieldBalances: bindOperation(
    api.YieldsControllerGetYieldBalances,
    runOptions
  ),
  YieldsControllerGetYieldValidators: bindOperation(
    api.YieldsControllerGetYieldValidators,
    runOptions
  ),
});

const bindApiClients = ({
  legacyApi,
  runOptions,
  yieldApi,
}: {
  readonly legacyApi: LegacyApi.LegacyApi;
  readonly runOptions?: RunOptions;
  readonly yieldApi: YieldApi.YieldApi;
}) => ({
  legacy: bindLegacyApi({ api: legacyApi, runOptions }),
  yield: bindYieldApi({ api: yieldApi, runOptions }),
});

export const createApiClient = ({
  apiKey,
  baseUrl,
  yieldsApiUrl,
}: WidgetApiClientOptions) => {
  const baseClient = runtime.runSync(HttpClient.HttpClient);

  const legacyHttpClient = configureClient({
    apiKey,
    baseUrl,
    client: baseClient,
  });
  const yieldHttpClient = configureClient({
    apiKey,
    baseUrl: yieldsApiUrl,
    client: baseClient,
  });
  const legacyApi = LegacyApi.make(legacyHttpClient);
  const yieldApi = YieldApi.make(yieldHttpClient);
  const boundClients = bindApiClients({ legacyApi, yieldApi });

  return {
    ...boundClients,
    withRunOptions: (runOptions: RunOptions) =>
      bindApiClients({ legacyApi, runOptions, yieldApi }),
  };
};

export type ApiClient = ReturnType<typeof createApiClient>;
