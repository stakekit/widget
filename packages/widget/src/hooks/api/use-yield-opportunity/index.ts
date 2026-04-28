import { useQuery } from "@tanstack/react-query";
import { useSKWallet } from "../../../providers/sk-wallet";
import { useYieldApiFetchClient } from "../../../providers/yield-api-client-provider";
import { queryFn } from "./get-yield-opportunity";

type Params = {
  yieldId: string;
  isLedgerLive: boolean;
  yieldApiFetchClient: ReturnType<typeof useYieldApiFetchClient>;
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
  const yieldApiFetchClient = useYieldApiFetchClient();

  const yieldId = integrationId ?? "";

  return useQuery({
    queryKey: getKey({
      yieldId,
      isLedgerLive,
      yieldApiFetchClient,
    }),
    enabled: !!integrationId,
    staleTime,
    queryFn: ({ signal }) =>
      queryFn({
        yieldId,
        isLedgerLive,
        signal,
        yieldApiFetchClient,
      }),
  });
};
