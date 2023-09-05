import { YieldDto, yieldGetMyYields } from "@stakekit/api-hooks";
import { UseQueryOptions, useQuery } from "@tanstack/react-query";
import { EitherAsync } from "purify-ts";
import { AxiosError } from "axios";
import { withRequestErrorRetry } from "../../../api/utils";

export const useAllEnabledOpportunities = (
  opts?: Omit<UseQueryOptions<YieldDto[], Error>, "queryKey" | "queryFn">
) => {
  return useQuery<YieldDto[], Error>(
    ["enabled-opportunities"],
    async ({ signal }) => {
      return await getMyYieldOpportunitiesRecursive({
        data: [],
        page: 1,
        signal,
      }).caseOf({
        Left: (e) => Promise.reject(e),
        Right: (r) => Promise.resolve(r),
      });
    },
    { staleTime: 1000 * 60 * 5, ...opts }
  );
};

const getMyYieldOpportunitiesRecursive = ({
  data,
  page,
  signal,
}: {
  page: number;
  data: YieldDto[];
  signal?: AbortSignal;
}): EitherAsync<AxiosError | Error, YieldDto[]> => {
  return withRequestErrorRetry({
    fn: () => yieldGetMyYields({ page: page, limit: 50 }, signal),
  })
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
