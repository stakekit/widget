import { useAtomValue } from "@effect/atom-react";
import { Cause, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { type PropsWithChildren, useState } from "react";
import { WagmiContext } from "wagmi";
import { makeDefaultConfig } from "../../../services/wallet/default-wagmi-config";
import { useGeoBlock } from "../../preferences/index";
import { currentWalletStateResultAtom } from "../state/root-atom";
import { useWalletConfig } from "./use-wallet-config";

/**
 * A Wallet Runtime failure, typed error or defect. Defects matter most: a
 * Wallet Bootstrap that throws dies, and `AsyncResult.error` ignores it.
 */
const walletRuntimeFailure = <A, E>(result: AsyncResult.AsyncResult<A, E>) =>
  AsyncResult.cause(result).pipe(
    Option.filter((cause) => !Cause.hasInterruptsOnly(cause))
  );

export const WagmiConfigProvider = ({ children }: PropsWithChildren) => {
  const walletConfigResult = useWalletConfig();
  const walletStateResult = useAtomValue(currentWalletStateResultAtom);
  const walletConfig = walletConfigResult.pipe(
    AsyncResult.value,
    Option.getOrUndefined
  );
  const walletFailure = walletRuntimeFailure(walletConfigResult).pipe(
    Option.orElse(() => walletRuntimeFailure(walletStateResult))
  );
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
