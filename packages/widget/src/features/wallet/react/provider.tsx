import { type PropsWithChildren, useState } from "react";
import { WagmiContext } from "wagmi";
import { getGeoBlockSnapshot } from "../../../services/api/geo-block-state";
import { makeDefaultConfig } from "../../../services/wallet/default-wagmi-config";
import { useWalletConfig } from "./use-wallet-config";

export const WagmiConfigProvider = ({ children }: PropsWithChildren) => {
  const walletConfig = useWalletConfig();
  const [fallbackConfig] = useState(makeDefaultConfig);

  if (walletConfig.error && !getGeoBlockSnapshot()) throw walletConfig.error;

  const value = walletConfig.data ?? fallbackConfig;

  return (
    <WagmiContext.Provider value={value}>{children}</WagmiContext.Provider>
  );
};
