import { useCallback, useSyncExternalStore } from "react";
import { Connector } from "wagmi";
import { Chain } from "@stakekit/rainbowkit";
import { Nullable } from "vitest";
import { isLedgerLiveConnector } from "../ledger/ledger-connector";

export const useLedgerDisabledChain = (connector?: Nullable<Connector>) => {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!connector || !isLedgerLiveConnector(connector)) {
        return () => {};
      }

      return connector.$disabledChains.subscribe(onChange);
    },
    [connector]
  );

  const getSnapshot = useCallback(() => {
    if (!connector || !isLedgerLiveConnector(connector)) {
      return defaultValue;
    }

    return connector.$disabledChains.value;
  }, [connector]);

  const getServerSnapshot = useCallback(() => {
    return defaultValue;
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
};

const defaultValue: Chain[] = [];
