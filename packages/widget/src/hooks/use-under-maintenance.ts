import { useQuery } from "@tanstack/react-query";
import { useYieldApiFetchClient } from "../providers/yield-api-client-provider";
import type { components } from "../types/yield-api-schema";

type HealthStatusDto = components["schemas"]["HealthStatusDto"];

export const useUnderMaintenance = () => {
  const yieldApiFetchClient = useYieldApiFetchClient();
  const { data, error } = useQuery<HealthStatusDto>({
    queryKey: ["yield-api-health"],
    queryFn: async ({ signal }) => {
      const response = await yieldApiFetchClient.GET("/health", { signal });

      if (response.data) {
        return response.data;
      }

      throw new YieldApiResponseError(response.response.status, response.error);
    },
    refetchInterval: 1000 * 30,
  });

  const isServiceUnavailable =
    error instanceof YieldApiResponseError && error.status >= 500;
  const isUnhealthy = data?.status !== undefined && data.status !== "OK";

  if (isServiceUnavailable || isUnhealthy) {
    return true;
  }

  return false;
};

class YieldApiResponseError extends Error {
  constructor(
    readonly status: number,
    override readonly cause?: unknown
  ) {
    super("Yield API health request failed");
  }
}
