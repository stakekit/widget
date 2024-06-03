import type { ChainWalletBase } from "@cosmos-kit/core";
import { useCallback, useState, useSyncExternalStore } from "react";
import { BehaviorSubject } from "rxjs";
import type { Connector } from "wagmi";
import { isCosmosConnector } from "../cosmos/cosmos-connector-meta";

export const useCosmosCW = (connector?: Connector) => {
  const [subject] = useState(
    () => new BehaviorSubject<ChainWalletBase | null>(null)
  );

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!connector || !isCosmosConnector(connector)) {
        return () => {};
      }

      const sub = connector.$chainWallet.subscribe((val) => {
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
