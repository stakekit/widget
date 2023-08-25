import { useCallback, useSyncExternalStore } from "react";
import { Connector } from "wagmi";
import { isLedgerLiveConnector } from "./utils";
import { Account } from "@ledgerhq/wallet-api-client";

export const useLedgerAccounts = (connector?: Connector) => {
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

    return connector.getAccountsOnCurrentChain();
  }, [connector]);

  return useSyncExternalStore(subscribe, getSnapshot);
};

const defaultValue: Account[] = [];
