import { useCallback, useState, useSyncExternalStore } from "react";
import { BehaviorSubject } from "rxjs";
import type { Chain } from "viem";
import type { Connector } from "wagmi";
import { isConnectorWithFilteredChains } from "../../domain/types/connectors";
import type { useWagmiConfig } from "../wagmi";

export const useConnectorChains = ({
  wagmiConfig,
  connector,
}: {
  wagmiConfig: ReturnType<typeof useWagmiConfig>["data"];
  connector?: Connector;
}) => {
  const [subject] = useState(() => new BehaviorSubject<Chain[]>([]));

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

  const getSnapshot = useCallback(() => {
    if (!connector || !isConnectorWithFilteredChains(connector)) {
      return wagmiConfig?.evmConfig.evmChains ?? defaultValue;
    }

    return subject.value;
  }, [connector, subject.value, wagmiConfig?.evmConfig.evmChains]);

  const getServerSnapshot = useCallback(() => subject.value, [subject.value]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
};

const defaultValue: Chain[] = [];
