import { useQuery } from "@tanstack/react-query";
import type { HealthStatusDto } from "../generated/api/yield";
import { useApiClient } from "../providers/api/api-client-provider";

export const useUnderMaintenance = () => {
  const apiClient = useApiClient();
  const { data, error } = useQuery<HealthStatusDto>({
    queryKey: ["yield-api-health"],
    queryFn: ({ signal }) =>
      apiClient
        .withRunOptions({ signal })
        .yield.HealthControllerHealth(undefined),
    refetchInterval: 1000 * 30,
  });

  const status =
    error instanceof Error &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "status" in error.response &&
    typeof error.response.status === "number"
      ? error.response.status
      : undefined;
  const isServiceUnavailable = status !== undefined && status >= 500;
  const isUnhealthy = data?.status !== undefined && data.status !== "OK";

  if (isServiceUnavailable || isUnhealthy) {
    return true;
  }

  return false;
};
