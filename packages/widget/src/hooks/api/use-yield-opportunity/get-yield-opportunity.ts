import type { QueryClient } from "@tanstack/react-query";
import { EitherAsync } from "purify-ts";
import {
  isEthenaUsdeStaking,
  type Yield,
  type YieldProviderDetails,
} from "../../../domain/types/yields";
import type { ApiClient } from "../../../providers/api/api-client";

type Params = {
  yieldId: string;
  isLedgerLive: boolean;
  apiClient: ApiClient;
  signal?: AbortSignal;
};

type MultiParams = Omit<Params, "yieldId"> & {
  yieldIds: ReadonlyArray<string>;
};
type ParamsWithQueryClient = Params & {
  queryClient: QueryClient;
};
type MultiParamsWithQueryClient = MultiParams & {
  queryClient: QueryClient;
};
type YieldApiYield = Omit<Yield, "__fallback__" | "provider">;

const staleTime = 1000 * 60 * 2;
const getKey = (params: Params) => [
  "yield-opportunity",
  params.yieldId,
  params.isLedgerLive,
];
const getMultiKey = (params: MultiParams) => [
  "yield-opportunities",
  params.yieldIds,
  params.isLedgerLive,
];
const getProviderKey = (providerId: string) => ["yield-provider", providerId];

const applyYieldOverrides = (yieldDto: Yield) =>
  isEthenaUsdeStaking(yieldDto.id)
    ? ({
        ...yieldDto,
        metadata: {
          ...yieldDto.metadata,
          name: yieldDto.metadata.name.replace(/staking/i, ""),
        },
      } satisfies Yield)
    : yieldDto;

const createYield = ({
  legacyYield,
  provider,
  yieldDto,
}: {
  legacyYield: Yield["__fallback__"];
  provider: YieldProviderDetails | undefined;
  yieldDto: YieldApiYield;
}) =>
  ({
    ...yieldDto,
    ...(provider ? { provider } : {}),
    __fallback__: legacyYield,
  }) satisfies Yield;

const fetchYieldProvider = async ({
  client,
  providerId,
  queryClient,
}: {
  client: ReturnType<ApiClient["withRunOptions"]>;
  providerId: string;
  queryClient: QueryClient;
}): Promise<YieldProviderDetails | undefined> => {
  try {
    return await queryClient.fetchQuery({
      queryKey: getProviderKey(providerId),
      staleTime,
      queryFn: () =>
        client.yield.ProvidersControllerGetProvider(providerId, undefined),
    });
  } catch (e) {
    console.log(e);
    return undefined;
  }
};

const fetchYieldProviders = async ({
  client,
  providerIds,
  queryClient,
}: {
  client: ReturnType<ApiClient["withRunOptions"]>;
  providerIds: ReadonlyArray<string>;
  queryClient: QueryClient;
}) => {
  const providers = await Promise.all(
    [...new Set(providerIds)].map(async (providerId) => ({
      providerId,
      provider: await fetchYieldProvider({ client, providerId, queryClient }),
    }))
  );

  return new Map(
    providers.flatMap(({ provider, providerId }) =>
      provider ? [[providerId, provider]] : []
    )
  );
};

export const getYieldOpportunity = (params: ParamsWithQueryClient) =>
  EitherAsync(() =>
    params.queryClient.fetchQuery({
      queryKey: getKey(params),
      staleTime,
      queryFn: () => queryFn(params),
    })
  ).mapLeft((e) => {
    console.log(e);
    return new Error("Could not get yield opportunity");
  });

export const getYieldOpportunities = (params: MultiParamsWithQueryClient) =>
  EitherAsync(() =>
    params.queryClient.fetchQuery({
      queryKey: getMultiKey(params),
      staleTime,
      queryFn: () => multiQueryFn(params),
    })
  )
    .chainLeft(() =>
      EitherAsync.all(
        params.yieldIds.map((yieldId) =>
          getYieldOpportunity({
            ...params,
            yieldId,
          }).chainLeft(() => EitherAsync(() => Promise.resolve(null)))
        )
      ).map((res) => res.filter((x) => x !== null))
    )
    .map((yields) => {
      yields.forEach((yieldDto) => {
        params.queryClient.setQueryData(
          getKey({
            ...params,
            yieldId: yieldDto.id,
          }),
          yieldDto
        );
      });

      return yields;
    })
    .mapLeft((e) => {
      console.log(e);
      return new Error("Could not get yield opportunities");
    });

export const queryFn = async (
  params: ParamsWithQueryClient & {
    signal?: AbortSignal;
  }
) => (await fn(params)).unsafeCoerce();

const multiQueryFn = async (
  params: MultiParamsWithQueryClient & {
    signal?: AbortSignal;
  }
) => (await multiFn(params)).unsafeCoerce();

const fn = ({
  isLedgerLive,
  yieldId,
  queryClient,
  signal,
  apiClient,
}: ParamsWithQueryClient & {
  signal?: AbortSignal;
}) => {
  return EitherAsync(async () => {
    const client = apiClient.withRunOptions({ signal });
    const [newYieldResult, legacyYieldResult] = await Promise.all([
      client.yield.YieldsControllerGetYield(yieldId, undefined),
      client.legacy.YieldControllerYieldOpportunity(yieldId, {
        params: { ledgerWalletAPICompatible: isLedgerLive },
      }),
    ]);
    const provider = await fetchYieldProvider({
      client,
      providerId: newYieldResult.providerId,
      queryClient,
    });

    return createYield({
      legacyYield: legacyYieldResult,
      provider,
      yieldDto: newYieldResult,
    });
  })
    .map(applyYieldOverrides)
    .mapLeft((e) => {
      console.log(e);
      return new Error("Could not get yield opportunity");
    });
};

const multiFn = ({
  isLedgerLive,
  queryClient,
  yieldIds,
  signal,
  apiClient,
}: MultiParamsWithQueryClient & {
  signal?: AbortSignal;
}) => {
  return EitherAsync(async () => {
    const client = apiClient.withRunOptions({ signal });
    const newYieldsResult = await client.yield.YieldsControllerGetYields({
      params: {
        yieldIds,
        limit: yieldIds.length,
      },
    });
    const newYieldsById = new Map(
      (newYieldsResult.items ?? []).map((yieldDto) => [yieldDto.id, yieldDto])
    );
    const providersById = await fetchYieldProviders({
      client,
      providerIds: [...newYieldsById.values()].map(
        (yieldDto) => yieldDto.providerId
      ),
      queryClient,
    });

    const yields = await Promise.all(
      yieldIds.map(async (yieldId) => {
        const newYieldResult = newYieldsById.get(yieldId);

        if (!newYieldResult) {
          return null;
        }

        try {
          const legacyYieldResult =
            await client.legacy.YieldControllerYieldOpportunity(yieldId, {
              params: { ledgerWalletAPICompatible: isLedgerLive },
            });

          return applyYieldOverrides(
            createYield({
              legacyYield: legacyYieldResult,
              provider: providersById.get(newYieldResult.providerId),
              yieldDto: newYieldResult,
            })
          );
        } catch (e) {
          console.log(e);
          return null;
        }
      })
    );

    return yields.filter((yieldDto) => yieldDto !== null);
  }).mapLeft((e) => {
    console.log(e);
    return new Error("Could not get yield opportunities");
  });
};
