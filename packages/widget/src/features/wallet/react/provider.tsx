import { type PropsWithChildren, useState } from "react";
import { WagmiContext } from "wagmi";
import { makeDefaultConfig } from "../../../services/wallet/default-wagmi-config";
import { useWalletController } from "../runtime/root-atom";

export const WagmiConfigProvider = ({ children }: PropsWithChildren) => {
  const controller = useWalletController();
  const [fallbackConfig] = useState(makeDefaultConfig);

  const value = controller.data?.wagmiConfig ?? fallbackConfig;

  return (
    <WagmiContext.Provider value={value}>{children}</WagmiContext.Provider>
  );
};
