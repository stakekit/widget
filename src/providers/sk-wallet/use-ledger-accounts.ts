import type { Account } from "@ledgerhq/wallet-api-client";
import { useCallback, useState, useSyncExternalStore } from "react";
import { BehaviorSubject } from "rxjs";
import type { Connector } from "wagmi";
import { isLedgerLiveConnector } from "../ledger/ledger-live-connector-meta";

export const useLedgerAccounts = (connector?: Connector) => {
  const [subject] = useState(() => new BehaviorSubject<Account[]>([]));

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!connector || !isLedgerLiveConnector(connector)) {
        return () => {};
      }

      const sub = connector.$accountsOnCurrentChain.subscribe((val) => {
        subject.next(val);
        onChange();
      });

      return () => sub.unsubscribe();
    },
    [connector, subject]
  );

  const getSnapshot = useCallback(() => subject.value, [subject]);
  const getServerSnapshot = useCallback(() => subject.value, [subject.value]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
};
