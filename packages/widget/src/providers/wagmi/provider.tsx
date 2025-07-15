import type { PropsWithChildren } from "react";
import { WagmiContext } from "wagmi";
import { defaultConfig, useWagmiConfig } from "../wagmi";

export const WagmiConfigProvider = ({ children }: PropsWithChildren) => {
  const wagmiConfig = useWagmiConfig();

  const value = wagmiConfig.data?.wagmiConfig ?? defaultConfig;

  return (
    <WagmiContext.Provider value={value}>{children}</WagmiContext.Provider>
  );
};
