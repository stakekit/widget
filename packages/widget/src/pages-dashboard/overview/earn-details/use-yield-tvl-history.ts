import { keepPreviousData, useQuery } from "@tanstack/react-query";
import BigNumber from "bignumber.js";
import { useMemo } from "react";
import { useApiClient } from "../../../providers/api/api-client-provider";
import {
  getYieldHistoryInterval,
  periodToApiPeriod,
  type RewardRateHistoryPeriod,
  type RewardRateHistoryPoint,
} from "./use-yield-reward-rate-history";

type TvlHistoryResponse = {
  readonly items?: ReadonlyArray<{
    readonly timestamp: string;
    readonly tvl?: string | null;
    readonly tvlUsd?: string | null;
  }>;
};

export const useYieldTvlHistory = ({
  period,
  yieldId,
}: {
  period: RewardRateHistoryPeriod;
  yieldId: string | undefined;
}) => {
  const apiClient = useApiClient();

  const query = useQuery({
    enabled: !!yieldId,
    queryKey: ["yield-tvl-history", yieldId, period],
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 2,
    queryFn: async ({ signal }) => {
      if (!yieldId) return [];

      const response = await apiClient
        .withRunOptions({ signal })
        .yield.YieldsControllerGetYieldTvlHistory(yieldId, {
          params: {
            period: periodToApiPeriod[period],
            interval: getYieldHistoryInterval(period),
          },
        });

      return (response as TvlHistoryResponse).items ?? [];
    },
  });

  const data = useMemo<RewardRateHistoryPoint[]>(
    () =>
      (query.data ?? [])
        .flatMap((item) => {
          const date = new Date(item.timestamp);
          const tvlValue = item.tvlUsd;

          if (!tvlValue) {
            return [];
          }

          const tvl = BigNumber(tvlValue);

          if (Number.isNaN(date.getTime()) || !tvl.isFinite()) {
            return [];
          }

          return [
            {
              date,
              timestamp: item.timestamp,
              value: tvl.toNumber(),
            },
          ];
        })
        .sort((a, b) => a.date.getTime() - b.date.getTime()),
    [query.data]
  );

  return { ...query, data };
};
