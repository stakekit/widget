import { useYieldYieldOpportunity } from "@stakekit/api-hooks";

export const useYieldOpportunity = (integrationId: string | undefined) =>
  useYieldYieldOpportunity(integrationId ?? "", {
    query: { enabled: !!integrationId, staleTime: 1000 * 60 * 2 },
  });
