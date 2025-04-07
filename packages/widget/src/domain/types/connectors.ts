import { isExternalProviderConnector } from "@sk-widget/providers/external-provider";
import { isLedgerLiveConnector } from "@sk-widget/providers/ledger/ledger-live-connector-meta";
import { isSafeConnector } from "@sk-widget/providers/safe/safe-connector-meta";
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

export const shouldShowDisconnect = (connector: Connector) =>
  !isExternalProviderConnector(connector) &&
  !isLedgerLiveConnector(connector) &&
  !isSafeConnector(connector);
