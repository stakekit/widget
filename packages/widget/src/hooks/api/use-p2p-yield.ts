import { p2pYieldId } from "@sk-widget/domain/types/yields";
import { getYieldOpportunity } from "@sk-widget/hooks/api/use-yield-opportunity/get-yield-opportunity";
import { useSKQueryClient } from "@sk-widget/providers/query-client";
import { useQuery } from "@tanstack/react-query";

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
