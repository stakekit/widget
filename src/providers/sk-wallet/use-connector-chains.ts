import { useCallback, useSyncExternalStore } from "react";
import { Connector } from "wagmi";
import {
  ConnectorWithFilteredChains,
  isConnectorWithFilteredChains,
} from "../../domain/types/connectors";
import { useWagmiConfig } from "../wagmi";

export const useConnectorChains = ({
  wagmiConfig,
  connector,
}: {
  wagmiConfig: ReturnType<typeof useWagmiConfig>["data"];
  connector?: Connector;
}) => {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!connector || !isConnectorWithFilteredChains(connector)) {
        return () => {};
      }

      return connector.$filteredChains.subscribe(onChange);
    },
    [connector]
  );

  const getSnapshot = useCallback(() => {
    if (!connector || !isConnectorWithFilteredChains(connector)) {
      return wagmiConfig?.evmConfig.evmChains ?? defaultValue;
    }

    return connector.$filteredChains.value;
  }, [connector, wagmiConfig?.evmConfig.evmChains]);

  const getServerSnapshot = useCallback(() => {
    return defaultValue;
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
};

const defaultValue: ConnectorWithFilteredChains["$filteredChains"]["value"] =
  [];
