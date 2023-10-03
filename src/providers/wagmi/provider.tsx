import { PropsWithChildren } from "react";
import { WagmiConfig } from "wagmi";
import { RainbowKitProviderWithTheme } from "../rainbow-kit";
import { defaultConfig, useWagmiConfig } from "../wagmi";

export const WagmiProvider = ({ children }: PropsWithChildren) => {
  const wagmiConfig = useWagmiConfig();

  return (
    <WagmiConfig config={wagmiConfig.data?.wagmiConfig ?? defaultConfig}>
      <RainbowKitProviderWithTheme chains={wagmiConfig.data?.chains ?? []}>
        {children}
      </RainbowKitProviderWithTheme>
    </WagmiConfig>
  );
};
