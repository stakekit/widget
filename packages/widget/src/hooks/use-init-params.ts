import { useQuery } from "@tanstack/react-query";
import type { InitParams } from "../domain/types/init-params";
import { useApiClient } from "../providers/api/api-client-provider";
import { useSKQueryClient } from "../providers/query-client";
import { useSettings } from "../providers/settings";
import { useSKWallet } from "../providers/sk-wallet";
import {
  initParamsCacheTime,
  initParamsQueryKey,
  initParamsStaleTime,
  queryInitParams,
} from "./get-init-params";

export { getInitParams } from "./get-init-params";

export const useInitParams = <T = InitParams>(opts?: {
  select: (val: InitParams) => T;
}) => {
  const { isLedgerLive } = useSKWallet();
  const { externalProviders } = useSettings();
  const queryClient = useSKQueryClient();
  const apiClient = useApiClient();

  return useQuery({
    queryKey: initParamsQueryKey,
    staleTime: initParamsStaleTime,
    gcTime: initParamsCacheTime,
    queryFn: () =>
      queryInitParams({
        isLedgerLive,
        queryClient,
        apiClient,
        externalProviders,
      }),
    select: opts?.select,
  });
};
