import type { YieldDto } from "@stakekit/api-hooks";
import type { QueryClient } from "@tanstack/react-query";
import { EitherAsync } from "purify-ts";
import { yieldYieldOpportunity } from "../../../common/private-api";
import { isEthenaUsdeStaking } from "../../../domain/types/yields";
import { adaptYieldDto } from "../../../providers/yield-api-client-provider/compat";
import { getResponseData } from "../../../providers/yield-api-client-provider/request-helpers";
import type { YieldApiFetchClient } from "../../../providers/yield-api-client-provider/types";

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
  const stripValidators = (yieldDto: YieldDto): YieldDto => ({
    ...yieldDto,
    validators: [],
  });

  return EitherAsync(async () => {
    const [newYieldResult, legacyYieldResult] = await Promise.allSettled([
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

    if (newYieldResult.status === "rejected") {
      if (legacyYieldResult.status === "fulfilled") {
        return stripValidators(legacyYieldResult.value);
      }

      throw newYieldResult.reason;
    }

    const merged = adaptYieldDto({
      yieldDto: newYieldResult.value,
      legacyYieldDto:
        legacyYieldResult.status === "fulfilled"
          ? legacyYieldResult.value
          : null,
    });

    return stripValidators(merged);
  })
    .map((y) =>
      isEthenaUsdeStaking(y.id)
        ? ({
            ...y,
            metadata: {
              ...y.metadata,
              name: y.metadata.name.replace(/staking/i, ""),
            },
          } satisfies YieldDto)
        : y
    )
    .mapLeft((e) => {
      console.log(e);
      return new Error("Could not get yield opportunity");
    });
};
