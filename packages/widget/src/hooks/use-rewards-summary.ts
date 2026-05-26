import { type QueryClient, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  type EnabledRewardsSummaryYieldId,
  isValidYieldIdForRewardsSummary,
} from "../domain/types/rewards";
import type { Yield } from "../domain/types/yields";
import type {
  AddressesDto,
  YieldRewardsSummaryResponseDto,
} from "../generated/api/legacy";
import type { ApiClient } from "../providers/api/api-client";
import { useApiClient } from "../providers/api/api-client-provider";
import { useSKQueryClient } from "../providers/query-client";
import { useSKWallet } from "../providers/sk-wallet";

export const useMultiRewardsSummary = <T = RewardsSummaryResult>(
  yieldIds: Yield["id"][],
  opts?: { select?: (val: RewardsSummaryResult) => T }
) => {
  const filteredYieldIds = useMemo(
    () => yieldIds.filter(isValidYieldIdForRewardsSummary),
    [yieldIds]
  );

  const { address, additionalAddresses } = useSKWallet();

  const queryClient = useSKQueryClient();
  const apiClient = useApiClient();

  return useQuery({
    enabled: !!address,
    staleTime: 0,
    queryKey: [
      "yield-rewards-summary",
      filteredYieldIds,
      address,
      additionalAddresses,
    ],
    select: opts?.select,
    queryFn: () =>
      Promise.all(
        filteredYieldIds.map((id) =>
          getSingleYieldRewardsSummary({
            queryClient,
            apiClient,
            yieldId: id,
            addresses: {
              address: address!,
              additionalAddresses: additionalAddresses ?? undefined,
            },
          }).then((res) => ({ yieldId: id, data: res }))
        )
      ).then((res) =>
        res.reduce(
          (acc, next) => {
            acc[next.yieldId] = next.data;
            return acc;
          },
          {} as Record<
            EnabledRewardsSummaryYieldId,
            YieldRewardsSummaryResponseDto
          >
        )
      ),
  });
};

export const useRewardsSummary = (yieldId: Yield["id"]) => {
  const { address, additionalAddresses } = useSKWallet();

  const queryClient = useSKQueryClient();
  const apiClient = useApiClient();

  return useQuery({
    enabled: isValidYieldIdForRewardsSummary(yieldId) && !!address,
    staleTime: 0,
    queryKey: ["yield-rewards-summary", yieldId, address, additionalAddresses],
    queryFn: () =>
      getSingleYieldRewardsSummary({
        queryClient,
        apiClient,
        yieldId: yieldId as EnabledRewardsSummaryYieldId,
        addresses: {
          address: address!,
          additionalAddresses: additionalAddresses ?? undefined,
        },
      }).then((res) => ({
        yieldId,
        data: res as unknown as YieldRewardsSummaryResponseDto,
      })),
  });
};

const getSingleYieldRewardsSummary = ({
  queryClient,
  apiClient,
  yieldId,
  addresses,
}: {
  queryClient: QueryClient;
  apiClient: ApiClient;
  yieldId: EnabledRewardsSummaryYieldId;
  addresses: AddressesDto;
}) =>
  queryClient.fetchQuery({
    queryKey: ["yield-rewards-summary", yieldId, addresses],
    queryFn: () =>
      apiClient.legacy.YieldControllerGetSingleYieldRewardsSummary(yieldId, {
        payload: { addresses },
      }),
  });

export type RewardsSummaryResult = Record<
  EnabledRewardsSummaryYieldId,
  YieldRewardsSummaryResponseDto
>;
