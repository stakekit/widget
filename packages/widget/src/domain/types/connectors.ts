import type { Observable } from "rxjs";
import type { Chain } from "viem";
import type { Connector } from "wagmi";
import { isExternalProviderConnector } from "../../providers/external-provider";
import { isLedgerLiveConnector } from "../../providers/ledger/ledger-live-connector-meta";
import { isSafeConnector } from "../../providers/safe/safe-connector-meta";

export type ConnectorWithFilteredChains = {
  $filteredChains: Observable<Chain[]>;
};

export const isConnectorWithFilteredChains = (
  connector: Connector
): connector is Connector & ConnectorWithFilteredChains => {
  return !!(connector as unknown as ConnectorWithFilteredChains)
    .$filteredChains;
};

export const shouldShowDisconnect = (connector: Connector) =>
  !isExternalProviderConnector(connector) &&
  !isLedgerLiveConnector(connector) &&
  !isSafeConnector(connector);
