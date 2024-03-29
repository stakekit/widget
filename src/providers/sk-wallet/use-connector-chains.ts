import { useCallback, useState, useSyncExternalStore } from "react";
import { Connector } from "wagmi";
import { isConnectorWithFilteredChains } from "../../domain/types/connectors";
import { useWagmiConfig } from "../wagmi";
import { BehaviorSubject } from "rxjs";
import { Chain } from "viem";

export const useConnectorChains = ({
  wagmiConfig,
  connector,
}: {
  wagmiConfig: ReturnType<typeof useWagmiConfig>["data"];
  connector?: Connector;
}) => {
  const [subject] = useState(
    () => new BehaviorSubject<Chain[]>(wagmiConfig?.evmConfig.evmChains ?? [])
  );

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!connector || !isConnectorWithFilteredChains(connector)) {
        return () => {};
      }

      const sub = connector.$filteredChains.subscribe((val) => {
        subject.next(val);
        onChange();
      });

      return () => sub.unsubscribe();
    },
    [connector, subject]
  );

  const getSnapshot = useCallback(() => subject.value, [subject.value]);
  const getServerSnapshot = useCallback(() => subject.value, [subject.value]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
};
