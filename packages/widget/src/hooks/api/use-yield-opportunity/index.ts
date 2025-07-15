import { useQuery } from "@tanstack/react-query";
import { useSKWallet } from "../../../providers/sk-wallet";
import { useWhitelistedValidators } from "../../use-whitelisted-validators";
import { queryFn } from "./get-yield-opportunity";

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
