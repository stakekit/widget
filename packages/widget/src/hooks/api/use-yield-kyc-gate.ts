import { useQuery } from "@tanstack/react-query";
import { Duration } from "effect";
import type { Maybe } from "purify-ts";
import { isKycGateBlocking, mapKycStatusToGate } from "../../domain/types/kyc";
import type { Yield } from "../../domain/types/yields";
import { useApiClient } from "../../providers/api/api-client-provider";
import { useSKWallet } from "../../providers/sk-wallet";

export const getYieldKycStatusQueryKey = ({
  address,
  yieldId,
}: {
  readonly address?: string;
  readonly yieldId?: string;
}) => ["yield-kyc-status", yieldId ?? null, address ?? null] as const;

export const useYieldKycGate = ({
  enabled = true,
  yieldDto,
}: {
  readonly enabled?: boolean;
  readonly yieldDto: Maybe<Yield>;
}) => {
  const apiClient = useApiClient();
  const { address } = useSKWallet();
  const selectedYield = yieldDto.extractNullable();
  const queryEnabled =
    enabled &&
    !!selectedYield &&
    !!address &&
    selectedYield.mechanics.requirements?.kycRequired === true;

  const query = useQuery({
    enabled: queryEnabled,
    queryKey: getYieldKycStatusQueryKey({
      address: address ?? undefined,
      yieldId: selectedYield?.id,
    }),
    staleTime: Duration.minutes(2).pipe(Duration.toMillis),
    queryFn: ({ signal }) =>
      apiClient
        .withOptions({ signal })
        .yield.KycControllerGetStatus(selectedYield?.id ?? "", {
          params: { address: address ?? "" },
        }),
  });

  const gate = !queryEnabled
    ? ({ state: "pass" } as const)
    : query.isError
      ? mapKycStatusToGate({ status: null, yieldDto: selectedYield })
      : mapKycStatusToGate({
          status: query.data,
          yieldDto: selectedYield,
        });

  return {
    ...query,
    gate,
    isGateBlocking:
      queryEnabled && (query.isLoading || isKycGateBlocking(gate)),
    isKycEnabled: queryEnabled,
  };
};
