import { useQuery } from "@tanstack/react-query";
import { p2pYieldId } from "../../domain/types/yields";
import { useSKQueryClient } from "../../providers/query-client";
import { getYieldOpportunity } from "./use-yield-opportunity/get-yield-opportunity";

export const useP2PYield = (enabled: boolean) => {
  const queryClient = useSKQueryClient();

  return useQuery({
    queryKey: ["p2p-yield"],
    enabled: enabled,
    queryFn: async () =>
      (
        await getYieldOpportunity({
          yieldId: p2pYieldId,
          isLedgerLive: false,
          whitelistedValidatorAddresses: null,
          queryClient,
        })
      ).unsafeCoerce(),
  });
};
