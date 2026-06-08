import { keepPreviousData, useQuery } from "@tanstack/react-query";
import BigNumber from "bignumber.js";
import { useMemo } from "react";
import { useApiClient } from "../../../providers/api/api-client-provider";

export type RewardRateHistoryPeriod = "30d" | "90d" | "1y" | "all";

export type RewardRateHistoryPoint = {
  date: Date;
  timestamp: string;
  value: number;
};

type RewardRateHistoryResponse = {
  readonly items?: ReadonlyArray<{
    readonly timestamp: string;
    readonly rewardRate: string;
  }>;
};

export const periodToApiPeriod = {
  "30d": "30d",
  "90d": "90d",
  "1y": "1y",
  all: "all",
} as const;

export const getYieldHistoryInterval = (period: RewardRateHistoryPeriod) =>
  period === "1y" || period === "all" ? "week" : "day";

export const useYieldRewardRateHistory = ({
  period,
  yieldId,
}: {
  period: RewardRateHistoryPeriod;
  yieldId: string | undefined;
}) => {
  const apiClient = useApiClient();

  const query = useQuery({
    enabled: !!yieldId,
    queryKey: ["yield-reward-rate-history", yieldId, period],
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 2,
    queryFn: async ({ signal }) => {
      if (!yieldId) return [];

      const response = await apiClient
        .withOptions({ signal })
        .yield.YieldsControllerGetYieldRewardRateHistory(yieldId, {
          params: {
            period: periodToApiPeriod[period],
            interval: getYieldHistoryInterval(period),
          },
        });

      return (response as RewardRateHistoryResponse).items ?? [];
    },
  });

  const data = useMemo(
    () =>
      (query.data ?? [])
        .flatMap((item) => {
          const date = new Date(item.timestamp);
          const rewardRate = BigNumber(item.rewardRate);

          if (Number.isNaN(date.getTime()) || !rewardRate.isFinite()) {
            return [];
          }

          return [
            {
              date,
              timestamp: item.timestamp,
              value: rewardRate.times(100).toNumber(),
            },
          ];
        })
        .sort((a, b) => a.date.getTime() - b.date.getTime()),
    [query.data]
  );

  return { ...query, data };
};
