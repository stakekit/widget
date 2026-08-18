import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { type PropsWithChildren, useState } from "react";
import { WagmiContext } from "wagmi";
import { makeDefaultConfig } from "../../../services/wallet/default-wagmi-config";
import { useGeoBlock } from "../../preferences/index";
import { useWalletConfig } from "./use-wallet-config";

export const WagmiConfigProvider = ({ children }: PropsWithChildren) => {
  const walletConfigResult = useWalletConfig();
  const walletConfig = walletConfigResult.pipe(
    AsyncResult.value,
    Option.getOrUndefined
  );
  const walletConfigError = walletConfigResult.pipe(
    AsyncResult.error,
    Option.getOrUndefined
  );
  const [fallbackConfig] = useState(makeDefaultConfig);
  const geoBlock = useGeoBlock();

  if (walletConfigError && !geoBlock) throw walletConfigError;

  const value = walletConfig ?? fallbackConfig;

  return (
    <WagmiContext.Provider value={value}>{children}</WagmiContext.Provider>
  );
};
