import { useCallback, useSyncExternalStore } from "react";
import { Connector } from "wagmi";
import { isLedgerLiveConnector } from "./utils";
import { Chain } from "@stakekit/rainbowkit";
import { Nullable } from "vitest";

export const useLedgerDisabledChain = (connector?: Nullable<Connector>) => {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!connector || !isLedgerLiveConnector(connector)) {
        return () => {};
      }

      connector.addListener("change", onChange);

      return () => connector.removeListener("change", onChange);
    },
    [connector]
  );

  const getSnapshot = useCallback(() => {
    if (!connector || !isLedgerLiveConnector(connector)) {
      return defaultValue;
    }

    return connector.disabledChains;
  }, [connector]);

  const getServerSnapshot = useCallback(() => {
    return defaultValue;
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
};

const defaultValue: Chain[] = [];
