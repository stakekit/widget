import { useCallback, useSyncExternalStore } from "react";
import { Connector } from "wagmi";
import { Account } from "@ledgerhq/wallet-api-client";
import { isLedgerLiveConnector } from "../ledger/ledger-connector";

export const useLedgerAccounts = (connector?: Connector) => {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!connector || !isLedgerLiveConnector(connector)) {
        return () => {};
      }

      return connector.$accountsOnCurrentChain.subscribe(onChange);
    },
    [connector]
  );

  const getSnapshot = useCallback(() => {
    if (!connector || !isLedgerLiveConnector(connector)) {
      return defaultValue;
    }

    return connector.$accountsOnCurrentChain.value;
  }, [connector]);

  const getServerSnapshot = useCallback(() => {
    return defaultValue;
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
};

const defaultValue: Account[] = [];
