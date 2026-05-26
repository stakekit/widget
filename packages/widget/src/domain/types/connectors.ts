import type { Observable } from "rxjs";
import type { Chain } from "viem";
import type { Connector } from "wagmi";

export type ConnectorWithFilteredChains = {
  $filteredChains: Observable<Chain[]>;
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
