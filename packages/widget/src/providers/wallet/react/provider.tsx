import { type PropsWithChildren, useState } from "react";
import { WagmiContext } from "wagmi";
import { useWalletController } from "../runtime/root-atom";
import { makeDefaultConfig } from "../wagmi/default-config";

export const WagmiConfigProvider = ({ children }: PropsWithChildren) => {
  const controller = useWalletController();
  const [fallbackConfig] = useState(makeDefaultConfig);

  const value = controller.data?.wagmiConfig ?? fallbackConfig;

  return (
    <WagmiContext.Provider value={value}>{children}</WagmiContext.Provider>
  );
};
