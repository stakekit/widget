import { RegistryProvider } from "@effect/atom-react";
import type { PropsWithChildren } from "react";
import { config } from "../../config";
import { useApiClient } from "../api/api-client-provider";
import { stakeKitEffectApiClientAtom } from "./stakekit-api-service";

export const SKAtomRuntimeProvider = ({ children }: PropsWithChildren) => {
  const apiClient = useApiClient();

  return (
    <RegistryProvider
      defaultIdleTTL={config.queryClient.cacheTime}
      initialValues={[[stakeKitEffectApiClientAtom, apiClient.effect]]}
    >
      {children}
    </RegistryProvider>
  );
};
