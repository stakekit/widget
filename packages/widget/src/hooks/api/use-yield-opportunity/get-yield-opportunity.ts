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

const staleTime = 1000 * 60 * 2;
const getKey = (params: Params) => [
  "yield-opportunity",
  params.yieldId,
  params.isLedgerLive,
];

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

export const queryFn = async (
  params: Params & {
    signal?: AbortSignal;
  }
) => (await fn(params)).unsafeCoerce();

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
    .map((y) =>
      isEthenaUsdeStaking(y.id)
        ? ({
            ...y,
            metadata: {
              ...y.metadata,
              name: y.metadata.name.replace(/staking/i, ""),
            },
          } satisfies Yield)
        : y
    )
    .mapLeft((e) => {
      console.log(e);
      return new Error("Could not get yield opportunity");
    });
};
