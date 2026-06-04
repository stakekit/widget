import { useQuery } from "@tanstack/react-query";
import type { Maybe } from "purify-ts";
import {
  getYieldKycRequirement,
  type KycStatusResult,
} from "../../domain/types/kyc";
import type { Yield } from "../../domain/types/yields";
import { useApiClient } from "../../providers/api/api-client-provider";
import { useSKWallet } from "../../providers/sk-wallet";

const getKycStatusQueryKey = (yieldId: string, address: string) =>
  ["kyc-status", yieldId, address] as const;

export const useKycStatus = (
  yieldId: string | undefined,
  address: string | null | undefined,
  opts?: { enabled?: boolean }
) => {
  const apiClient = useApiClient();

  return useQuery<KycStatusResult>({
    queryKey: getKycStatusQueryKey(yieldId ?? "", address ?? ""),
    queryFn: ({ signal }) =>
      apiClient.getKycStatus(yieldId as string, address as string, { signal }),
    // per-address, so short cache
    staleTime: 1000 * 30,
    enabled: !!yieldId && !!address && (opts?.enabled ?? true),
  });
};

// prefetch so the gate is resolved before the cta is clicked
export const useKycStatusPrefetch = (selectedStake: Maybe<Yield>) => {
  const { address, isConnected } = useSKWallet();

  const yieldDto = selectedStake.extractNullable();
  const requiresKyc = yieldDto
    ? getYieldKycRequirement(yieldDto).required
    : false;

  return useKycStatus(yieldDto?.id, address, {
    enabled: isConnected && requiresKyc,
  });
};
