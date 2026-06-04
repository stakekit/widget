import { Effect, flow, ManagedRuntime } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http";
import { waitForDelayedApiRequests } from "../../common/delay-api-requests";
import type { KycStatusResult } from "../../domain/types/kyc";
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

type ApiRuntime = ManagedRuntime.ManagedRuntime<HttpClient.HttpClient, never>;

type BoundOperation<Operation> = Operation extends (
  ...args: infer Args
) => Effect.Effect<infer A, infer _E>
  ? (...args: Args) => Promise<A>
  : never;

const bindOperation = <
  Operation extends (...args: never[]) => Effect.Effect<unknown, unknown>,
>(
  runtime: ApiRuntime,
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
  runtime,
}: {
  readonly api: LegacyApi.LegacyApi;
  readonly runOptions?: RunOptions;
  readonly runtime: ApiRuntime;
}) => ({
  TokenControllerGetTokenBalances: bindOperation(
    runtime,
    api.TokenControllerGetTokenBalances,
    runOptions
  ),
  TokenControllerGetTokenPrices: bindOperation(
    runtime,
    api.TokenControllerGetTokenPrices,
    runOptions
  ),
  TokenControllerGetTokens: bindOperation(
    runtime,
    api.TokenControllerGetTokens,
    runOptions
  ),
  TokenControllerTokenBalancesScan: bindOperation(
    runtime,
    api.TokenControllerTokenBalancesScan,
    runOptions
  ),
  TransactionControllerGetTransactionVerificationMessageForNetwork:
    bindOperation(
      runtime,
      api.TransactionControllerGetTransactionVerificationMessageForNetwork,
      runOptions
    ),
  YieldControllerGetSingleYieldRewardsSummary: bindOperation(
    runtime,
    api.YieldControllerGetSingleYieldRewardsSummary,
    runOptions
  ),
  YieldControllerYieldOpportunity: bindOperation(
    runtime,
    api.YieldControllerYieldOpportunity,
    runOptions
  ),
});

const bindYieldApi = ({
  api,
  runOptions,
  runtime,
}: {
  readonly api: YieldApi.YieldApi;
  readonly runOptions?: RunOptions;
  readonly runtime: ApiRuntime;
}) => ({
  ActionsControllerEnterYield: bindOperation(
    runtime,
    api.ActionsControllerEnterYield,
    runOptions
  ),
  ActionsControllerExitYield: bindOperation(
    runtime,
    api.ActionsControllerExitYield,
    runOptions
  ),
  ActionsControllerGetActions: bindOperation(
    runtime,
    api.ActionsControllerGetActions,
    runOptions
  ),
  ActionsControllerManageYield: bindOperation(
    runtime,
    api.ActionsControllerManageYield,
    runOptions
  ),
  HealthControllerHealth: bindOperation(
    runtime,
    api.HealthControllerHealth,
    runOptions
  ),
  NetworksControllerGetNetworks: bindOperation(
    runtime,
    api.NetworksControllerGetNetworks,
    runOptions
  ),
  TransactionsControllerGetTransaction: bindOperation(
    runtime,
    api.TransactionsControllerGetTransaction,
    runOptions
  ),
  TransactionsControllerSubmitTransaction: bindOperation(
    runtime,
    api.TransactionsControllerSubmitTransaction,
    runOptions
  ),
  TransactionsControllerSubmitTransactionHash: bindOperation(
    runtime,
    api.TransactionsControllerSubmitTransactionHash,
    runOptions
  ),
  YieldsControllerGetAggregateBalances: bindOperation(
    runtime,
    api.YieldsControllerGetAggregateBalances,
    runOptions
  ),
  YieldsControllerGetYield: bindOperation(
    runtime,
    api.YieldsControllerGetYield,
    runOptions
  ),
  YieldsControllerGetYieldBalances: bindOperation(
    runtime,
    api.YieldsControllerGetYieldBalances,
    runOptions
  ),
  YieldsControllerGetYieldValidators: bindOperation(
    runtime,
    api.YieldsControllerGetYieldValidators,
    runOptions
  ),
});

const bindApiClients = ({
  legacyApi,
  runOptions,
  runtime,
  yieldApi,
}: {
  readonly legacyApi: LegacyApi.LegacyApi;
  readonly runOptions?: RunOptions;
  readonly runtime: ApiRuntime;
  readonly yieldApi: YieldApi.YieldApi;
}) => ({
  legacy: bindLegacyApi({ api: legacyApi, runOptions, runtime }),
  yield: bindYieldApi({ api: yieldApi, runOptions, runtime }),
});

export const createApiClient = ({
  apiKey,
  baseUrl,
  yieldsApiUrl,
}: WidgetApiClientOptions) => {
  const runtime = ManagedRuntime.make(FetchHttpClient.layer);
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
  const boundClients = bindApiClients({ legacyApi, runtime, yieldApi });

  // not in the generated client yet; runs through the configured yield client
  const getKycStatus = (
    yieldId: string,
    address: string,
    runOptions?: RunOptions
  ): Promise<KycStatusResult> =>
    runtime.runPromise(
      yieldHttpClient
        .execute(
          HttpClientRequest.get(`/v1/yields/${yieldId}/kyc/status`).pipe(
            HttpClientRequest.setUrlParams({ address })
          )
        )
        .pipe(
          Effect.flatMap(HttpClientResponse.filterStatusOk),
          Effect.flatMap((response) => response.json),
          Effect.map((data) => data as KycStatusResult)
        ),
      runOptions
    );

  return {
    ...boundClients,
    getKycStatus,
    withRunOptions: (runOptions: RunOptions) =>
      bindApiClients({ legacyApi, runOptions, runtime, yieldApi }),
    dispose: () => runtime.dispose(),
  };
};

export type ApiClient = ReturnType<typeof createApiClient>;
