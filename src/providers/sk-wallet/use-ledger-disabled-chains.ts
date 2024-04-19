import { useCallback, useState, useSyncExternalStore } from "react";
import type { Connector } from "wagmi";
import type { Chain } from "@stakekit/rainbowkit";
import type { Nullable } from "vitest";
import { BehaviorSubject } from "rxjs";
import { isLedgerLiveConnector } from "../ledger/ledger-live-connector-meta";

export const useLedgerDisabledChain = (connector?: Nullable<Connector>) => {
  const [subject] = useState(() => new BehaviorSubject<Chain[]>([]));

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!connector || !isLedgerLiveConnector(connector)) {
        return () => {};
      }

      const sub = connector.$disabledChains.subscribe((val) => {
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
