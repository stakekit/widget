import type { QueryClient } from "@tanstack/react-query";
import { EitherAsync } from "purify-ts";
import {
  isEthenaUsdeStaking,
  type Yield,
  type YieldBase,
  type YieldProviderDetails,
} from "../../../domain/types/yields";
import type { ApiClient } from "../../../providers/api/api-client";
import {
  fetchYieldProvider,
  fetchYieldProviders,
} from "../use-yield-providers";
import { fetchYieldSummariesByIds } from "../use-yield-summaries";

type Params = {
  yieldId: string;
  isLedgerLive: boolean;
  apiClient: ApiClient;
  signal?: AbortSignal;
  suppressRichErrors?: boolean;
};

type MultiParams = Omit<Params, "yieldId"> & {
  yieldIds: ReadonlyArray<string>;
};
type ParamsWithQueryClient = Params & {
  queryClient: QueryClient;
};
type ParamsWithYieldDto = Omit<ParamsWithQueryClient, "yieldId"> & {
  yieldDto: YieldBase;
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

export const getYieldOpportunityFromSummary = (params: ParamsWithYieldDto) =>
  EitherAsync(() =>
    params.queryClient.fetchQuery({
      queryKey: getKey({ ...params, yieldId: params.yieldDto.id }),
      staleTime,
      queryFn: () => hydrateYieldSummaryQueryFn(params),
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
  suppressRichErrors,
  apiClient,
}: ParamsWithQueryClient & {
  signal?: AbortSignal;
}) => {
  return EitherAsync(async () => {
    const client = apiClient.withOptions({ signal, suppressRichErrors });
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

const hydrateYieldSummaryQueryFn = async ({
  isLedgerLive,
  yieldDto,
  queryClient,
  signal,
  suppressRichErrors,
  apiClient,
}: ParamsWithYieldDto & {
  signal?: AbortSignal;
}) => {
  const client = apiClient.withOptions({ signal, suppressRichErrors });
  const [legacyYieldResult, provider] = await Promise.all([
    client.legacy.YieldControllerYieldOpportunity(yieldDto.id, {
      params: { ledgerWalletAPICompatible: isLedgerLive },
    }),
    yieldDto.provider
      ? Promise.resolve(yieldDto.provider)
      : fetchYieldProvider({
          client,
          providerId: yieldDto.providerId,
          queryClient,
        }),
  ]);

  return applyYieldOverrides(
    createYield({
      legacyYield: legacyYieldResult,
      provider,
      yieldDto,
    })
  );
};

const multiFn = ({
  isLedgerLive,
  queryClient,
  yieldIds,
  signal,
  suppressRichErrors,
  apiClient,
}: MultiParamsWithQueryClient & {
  signal?: AbortSignal;
}) => {
  return EitherAsync(async () => {
    const client = apiClient.withOptions({ signal, suppressRichErrors });
    const newYields = await fetchYieldSummariesByIds({
      apiClient,
      signal,
      suppressRichErrors,
      yieldIds,
    });
    const newYieldsById = new Map(
      newYields.map((yieldDto) => [yieldDto.id, yieldDto])
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
