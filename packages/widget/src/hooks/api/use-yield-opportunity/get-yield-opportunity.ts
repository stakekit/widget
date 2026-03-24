import type { QueryClient } from "@tanstack/react-query";
import { EitherAsync } from "purify-ts";
import { yieldYieldOpportunity } from "../../../common/private-api";
import type { YieldApiFetchClient } from "../../../domain/types/yield-api";
import { isEthenaUsdeStaking, type Yield } from "../../../domain/types/yields";
import { getResponseData } from "../../../providers/yield-api-client-provider/request-helpers";

type Params = {
  yieldId: string;
  isLedgerLive: boolean;
  yieldApiFetchClient: YieldApiFetchClient;
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
  yieldApiFetchClient,
}: Params & {
  signal?: AbortSignal;
}) => {
  return EitherAsync(async () => {
    const [newYieldResult, legacyYieldResult] = await Promise.all([
      getResponseData(
        yieldApiFetchClient.GET("/v1/yields/{yieldId}", {
          params: {
            path: {
              yieldId,
            },
          },
          signal,
        })
      ),
      yieldYieldOpportunity(
        yieldId,
        { ledgerWalletAPICompatible: isLedgerLive },
        signal
      ),
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
