import { useCallback, useState, useSyncExternalStore } from "react";
import type { Connector } from "wagmi";
import { BehaviorSubject } from "rxjs";
import { isLedgerLiveConnector } from "../ledger/ledger-live-connector-meta";

export const useLedgerCurrentAccountId = (connector?: Connector) => {
  const [subject] = useState(
    () => new BehaviorSubject<string | undefined>(undefined)
  );

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!connector || !isLedgerLiveConnector(connector)) {
        return () => {};
      }

      const sub = connector.$currentAccountId.subscribe((val) => {
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
