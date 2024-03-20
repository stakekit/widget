import { PropsWithChildren } from "react";
import { WagmiProvider } from "wagmi";
import { defaultConfig, useWagmiConfig } from "../wagmi";

export const WagmiConfigProvider = ({ children }: PropsWithChildren) => {
  const wagmiConfig = useWagmiConfig();

  return (
    <WagmiProvider config={wagmiConfig.data?.wagmiConfig ?? defaultConfig}>
      {children}
    </WagmiProvider>
  );
};
