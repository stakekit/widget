import {
  type EnabledRewardsSummaryYieldId,
  isValidYieldIdForRewardsSummary,
} from "@sk-widget/domain/types/rewards";
import { useSKQueryClient } from "@sk-widget/providers/query-client";
import { useSKWallet } from "@sk-widget/providers/sk-wallet";
import {
  type AddressesDto,
  type YieldDto,
  type YieldRewardsSummaryResponseDto,
  yieldGetSingleYieldRewardsSummary,
} from "@stakekit/api-hooks";
import { type QueryClient, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export const useMultiRewardsSummary = <T = RewardsSummaryResult>(
  yieldIds: YieldDto["id"][],
  opts?: { select?: (val: RewardsSummaryResult) => T }
) => {
  const filteredYieldIds = useMemo(
    () => yieldIds.filter(isValidYieldIdForRewardsSummary),
    [yieldIds]
  );

  const { address, additionalAddresses } = useSKWallet();

  const queryClient = useSKQueryClient();

  return useQuery({
    enabled: filteredYieldIds.length > 0 && !!address,
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
            acc[next.yieldId] =
              next.data as unknown as YieldRewardsSummaryResponseDto;
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

export const useRewardsSummary = (yieldId: YieldDto["id"]) => {
  const { address, additionalAddresses } = useSKWallet();

  const queryClient = useSKQueryClient();

  return useQuery({
    enabled: isValidYieldIdForRewardsSummary(yieldId) && !!address,
    staleTime: 0,
    queryKey: ["yield-rewards-summary", yieldId, address, additionalAddresses],
    queryFn: () =>
      getSingleYieldRewardsSummary({
        queryClient,
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
  yieldId,
  addresses,
}: {
  queryClient: QueryClient;
  yieldId: EnabledRewardsSummaryYieldId;
  addresses: AddressesDto;
}) =>
  queryClient.fetchQuery({
    queryKey: ["yield-rewards-summary", yieldId, addresses],
    queryFn: () => yieldGetSingleYieldRewardsSummary(yieldId, { addresses }),
  });

export type RewardsSummaryResult = Record<
  EnabledRewardsSummaryYieldId,
  YieldRewardsSummaryResponseDto
>;
