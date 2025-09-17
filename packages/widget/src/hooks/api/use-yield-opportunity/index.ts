import { useQuery } from "@tanstack/react-query";
import type { ValidatorsConfig } from "../../../domain/types/yields";
import { useSKWallet } from "../../../providers/sk-wallet";
import { useValidatorsConfig } from "../../use-validators-config";
import { queryFn } from "./get-yield-opportunity";

type Params = {
  yieldId: string;
  isLedgerLive: boolean;
  validatorsConfig: ValidatorsConfig;
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

  const validatorsConfig = useValidatorsConfig();

  const yieldId = integrationId ?? "";

  return useQuery({
    queryKey: getKey({ yieldId, isLedgerLive, validatorsConfig }),
    enabled: !!integrationId,
    staleTime,
    queryFn: ({ signal }) =>
      queryFn({ yieldId, isLedgerLive, signal, validatorsConfig }),
  });
};
