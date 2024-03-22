import { PropsWithChildren } from "react";
import { WagmiContext } from "wagmi";
import { hydrate } from "@wagmi/core";
import { defaultConfig, useWagmiConfig } from "../wagmi";
import { useQuery } from "@tanstack/react-query";
import { useSKQueryClient } from "../query-client";
import { useUpdateEffect } from "../../hooks/use-update-effect";

const queryKey = ["wagmi-config", "on-mount"];

export const WagmiConfigProvider = ({ children }: PropsWithChildren) => {
  const queryClient = useSKQueryClient();
  const wagmiConfig = useWagmiConfig();

  const config = wagmiConfig.data?.wagmiConfig;

  useQuery({
    queryKey,
    staleTime: Infinity,
    queryFn: () => {
      if (!config) return null;

      const { onMount } = hydrate(config, { reconnectOnMount: true });

      return onMount();
    },
  });

  useUpdateEffect(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [config]);

  return (
    <WagmiContext.Provider value={config ?? defaultConfig}>
      {children}
    </WagmiContext.Provider>
  );
};
