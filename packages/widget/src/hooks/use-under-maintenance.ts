import { type HealthStatusDto, useHealthHealthV2 } from "@stakekit/api-hooks";
import type { AxiosError } from "axios";

export const useUnderMaintenance = () => {
  const { data, error } = useHealthHealthV2<HealthStatusDto, AxiosError>({
    query: { refetchInterval: 1000 * 30 },
  });

  if (error?.status === 500 || (data?.db && data.db !== "OK")) return true;
  return false;
};
