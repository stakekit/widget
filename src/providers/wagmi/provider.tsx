import { PropsWithChildren } from "react";
import { WagmiConfig } from "wagmi";
import { defaultConfig, useWagmiConfig } from "../wagmi";

export const WagmiProvider = ({ children }: PropsWithChildren) => {
  const wagmiConfig = useWagmiConfig();

  return (
    <WagmiConfig config={wagmiConfig.data?.wagmiConfig ?? defaultConfig}>
      {children}
    </WagmiConfig>
  );
};
