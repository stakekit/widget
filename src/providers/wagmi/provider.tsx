import { PropsWithChildren } from "react";
import { WagmiContext } from "wagmi";
import { hydrate } from "@wagmi/core";
import { defaultConfig, useWagmiConfig } from "../wagmi";
import { useQuery } from "@tanstack/react-query";
import { EitherAsync } from "purify-ts";

const queryKey = ["wagmi-config", "on-mount"];

export const WagmiConfigProvider = ({ children }: PropsWithChildren) => {
  const wagmiConfig = useWagmiConfig();

  const config = wagmiConfig.data?.wagmiConfig;

  useQuery({
    queryKey,
    staleTime: Infinity,
    enabled: !!config,
    queryFn: async () => {
      if (config) {
        const { onMount } = hydrate(config, { reconnectOnMount: true });

        await EitherAsync(onMount);
      }

      return null;
    },
  });

  return (
    <WagmiContext.Provider value={config ?? defaultConfig}>
      {children}
    </WagmiContext.Provider>
  );
};
