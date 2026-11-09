import { useAtomValue } from "@effect/atom-react";
import { Cause, Option } from "effect";
import { type PropsWithChildren, useState } from "react";
import { WagmiContext } from "wagmi";

import { makeDefaultConfig } from "../../../services/wallet/default-wagmi-config";
import { useGeoBlock } from "../../preferences/index";
import { wagmiConfigViewAtom } from "../state/wagmi-config";

export const WagmiConfigProvider = ({ children }: PropsWithChildren) => {
  const { config: walletConfig, failure: walletFailure } =
    useAtomValue(wagmiConfigViewAtom);
  const [fallbackConfig] = useState(makeDefaultConfig);
  const geoBlock = useGeoBlock();

  // The route error boundary replaces the widget with the unavailable notice.
  if (Option.isSome(walletFailure) && !geoBlock) {
    throw Cause.squash(walletFailure.value);
  }

  const value = walletConfig ?? fallbackConfig;

  return (
    <WagmiContext.Provider value={value}>{children}</WagmiContext.Provider>
  );
};
