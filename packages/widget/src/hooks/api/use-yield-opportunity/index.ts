import { queryFn } from "@sk-widget/hooks/api/use-yield-opportunity/get-yield-opportunity";
import { useWhitelistedValidators } from "@sk-widget/hooks/use-whitelisted-validators";
import { useSKWallet } from "@sk-widget/providers/sk-wallet";
import { useQuery } from "@tanstack/react-query";

type Params = {
  yieldId: string;
  isLedgerLive: boolean;
  whitelistedValidatorAddresses: Set<string> | null;
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

  const whitelistedValidatorAddresses = useWhitelistedValidators();

  const yieldId = integrationId ?? "";

  return useQuery({
    queryKey: getKey({ yieldId, isLedgerLive, whitelistedValidatorAddresses }),
    enabled: !!integrationId,
    staleTime,
    queryFn: ({ signal }) =>
      queryFn({ yieldId, isLedgerLive, signal, whitelistedValidatorAddresses }),
  });
};
