import {
  YieldOpportunityDto,
  stakeV2GetMyYieldOpportunities,
} from "@stakekit/api-hooks";
import { UseQueryOptions, useQuery } from "@tanstack/react-query";
import { EitherAsync } from "purify-ts";
import { withRetry } from "../../utils";

export const useAllEnabledOpportunities = (
  opts?: Omit<
    UseQueryOptions<YieldOpportunityDto[], Error>,
    "queryKey" | "queryFn"
  >
) => {
  return useQuery<YieldOpportunityDto[], Error>(
    ["enabled-opportunities"],
    async ({ signal }) => {
      const result = await getMyYieldOpportunitiesRecursive({
        data: [],
        page: 1,
        signal,
      });

      return result.caseOf({
        Left: (e) => Promise.reject(e),
        Right: (r) => Promise.resolve(r),
      });
    },
    opts
  );
};

const getMyYieldOpportunitiesRecursive = ({
  data,
  page,
  signal,
}: {
  page: number;
  data: YieldOpportunityDto[];
  signal?: AbortSignal;
}): EitherAsync<Error, YieldOpportunityDto[]> => {
  return EitherAsync(
    withRetry({
      retryTimes: 2,
      fn: () =>
        stakeV2GetMyYieldOpportunities(
          {
            page: page,
            limit: 50,
          },
          signal
        ),
    })
  )
    .mapLeft(
      () => new Error(`Failed to fetch yield opportunities at page ${page}`)
    )
    .chain((response) => {
      data.push(...response.data);

      if (response.hasNextPage) {
        return getMyYieldOpportunitiesRecursive({
          page: page + 1,
          data,
          signal,
        });
      } else {
        return EitherAsync(async () => data);
      }
    });
};
