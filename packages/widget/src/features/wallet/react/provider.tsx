import { type PropsWithChildren, useState } from "react";
import { WagmiContext } from "wagmi";
import { makeDefaultConfig } from "../../../services/wallet/default-wagmi-config";
import { useWalletRuntimeConfig } from "../runtime/root-atom";

export const WagmiConfigProvider = ({ children }: PropsWithChildren) => {
  const runtimeConfig = useWalletRuntimeConfig();
  const [fallbackConfig] = useState(makeDefaultConfig);

  if (runtimeConfig.error) throw runtimeConfig.error;

  const value = runtimeConfig.data ?? fallbackConfig;

  return (
    <WagmiContext.Provider value={value}>{children}</WagmiContext.Provider>
  );
};
