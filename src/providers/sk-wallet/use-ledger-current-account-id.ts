import { useCallback, useState, useSyncExternalStore } from "react";
import { Connector } from "wagmi";
import { isLedgerLiveConnector } from "../ledger/ledger-connector";
import { BehaviorSubject } from "rxjs";

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
