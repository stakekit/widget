import type { Stream } from "effect";
import type { Chain } from "viem";
import type { Connector } from "wagmi";

export type ConnectorWithFilteredChains = {
  $filteredChains: Stream.Stream<Chain[]>;
};

export const isConnectorWithFilteredChains = (
  connector: Connector
): connector is Connector & ConnectorWithFilteredChains => {
  return !!(connector as unknown as ConnectorWithFilteredChains)
    .$filteredChains;
};

const connectorsWithoutDisconnect = new Set([
  "externalProviderConnector",
  "ledgerLive",
  "safe",
]);

export const shouldShowDisconnect = (connector: Connector) =>
  !connectorsWithoutDisconnect.has(connector.id);
