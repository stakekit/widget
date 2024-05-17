import type { PropsWithChildren } from "react";
import { WagmiContext } from "wagmi";
import { defaultConfig, useWagmiConfig } from "../wagmi";

export const WagmiConfigProvider = ({ children }: PropsWithChildren) => {
  const wagmiConfig = useWagmiConfig();

  return (
    <WagmiContext.Provider
      value={wagmiConfig.data?.wagmiConfig ?? defaultConfig}
    >
      {children}
    </WagmiContext.Provider>
  );
};
