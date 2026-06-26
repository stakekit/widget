import type { QueryClient } from "@tanstack/react-query";
import { EitherAsync } from "purify-ts";
import {
  isEthenaUsdeStaking,
  type Yield,
  type YieldBase,
  type YieldProviderDetails,
} from "../../../domain/types/yields";
import type { ApiClient } from "../../../providers/api/api-client";
import { fetchYieldProvider } from "../use-yield-providers";
import { fetchYieldSummariesWithProvidersByIds } from "../use-yield-summaries";

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
type MultiParamsWithQueryClient = MultiParams & {
  queryClient: QueryClient;
};

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
  provider,
  yieldDto,
}: {
  provider: YieldProviderDetails | undefined;
  yieldDto: YieldBase;
}) =>
  ({
    ...yieldDto,
    ...(provider ? { provider } : {}),
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
    const newYieldResult = await client.yield.YieldsControllerGetYield(
      yieldId,
      undefined
    );
    const provider = await fetchYieldProvider({
      client,
      providerId: newYieldResult.providerId,
      queryClient,
    });

    return createYield({
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
  queryClient,
  yieldIds,
  signal,
  suppressRichErrors,
  apiClient,
}: MultiParamsWithQueryClient & {
  signal?: AbortSignal;
}) => {
  return EitherAsync(async () => {
    const yields = await fetchYieldSummariesWithProvidersByIds({
      apiClient,
      queryClient,
      signal,
      suppressRichErrors,
      yieldIds,
    });

    return yields.map((yieldDto) =>
      applyYieldOverrides(
        createYield({
          provider: yieldDto.provider,
          yieldDto,
        })
      )
    );
  }).mapLeft((e) => {
    console.log(e);
    return new Error("Could not get yield opportunities");
  });
};
