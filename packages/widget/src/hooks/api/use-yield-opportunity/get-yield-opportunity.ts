import type { QueryClient } from "@tanstack/react-query";
import { EitherAsync } from "purify-ts";
import { isEthenaUsdeStaking, type Yield } from "../../../domain/types/yields";
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

export const getYieldOpportunity = (
  params: Params & {
    queryClient: QueryClient;
  }
) =>
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

export const getYieldOpportunities = (
  params: MultiParams & {
    queryClient: QueryClient;
  }
) =>
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
  params: Params & {
    signal?: AbortSignal;
  }
) => (await fn(params)).unsafeCoerce();

const multiQueryFn = async (
  params: MultiParams & {
    signal?: AbortSignal;
  }
) => (await multiFn(params)).unsafeCoerce();

const fn = ({
  isLedgerLive,
  yieldId,
  signal,
  apiClient,
}: Params & {
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

    return {
      ...newYieldResult,
      __fallback__: legacyYieldResult,
    } satisfies Yield;
  })
    .map(applyYieldOverrides)
    .mapLeft((e) => {
      console.log(e);
      return new Error("Could not get yield opportunity");
    });
};

const multiFn = ({
  isLedgerLive,
  yieldIds,
  signal,
  apiClient,
}: MultiParams & {
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

          return applyYieldOverrides({
            ...newYieldResult,
            __fallback__: legacyYieldResult,
          } satisfies Yield);
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
