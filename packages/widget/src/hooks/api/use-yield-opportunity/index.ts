import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "../../../providers/api/api-client-provider";
import { useSKQueryClient } from "../../../providers/query-client";
import { useSKWallet } from "../../../providers/sk-wallet";
import { queryFn } from "./get-yield-opportunity";

type Params = {
  yieldId: string;
  isLedgerLive: boolean;
  apiClient: ReturnType<typeof useApiClient>;
  queryClient: ReturnType<typeof useSKQueryClient>;
  signal?: AbortSignal;
};

const staleTime = 1000 * 60 * 2;
const getKey = (params: Params) => [
  "yield-opportunity",
  params.yieldId,
  params.isLedgerLive,
];

export const useYieldOpportunity = (integrationId: string | undefined) => {
  const { isLedgerLive } = useSKWallet();
  const apiClient = useApiClient();
  const queryClient = useSKQueryClient();

  const yieldId = integrationId ?? "";

  return useQuery({
    queryKey: getKey({
      yieldId,
      isLedgerLive,
      apiClient,
      queryClient,
    }),
    enabled: !!integrationId,
    staleTime,
    queryFn: ({ signal }) =>
      queryFn({
        yieldId,
        isLedgerLive,
        signal,
        apiClient,
        queryClient,
      }),
  });
};
