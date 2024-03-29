import { Observable } from "rxjs";
import { Chain } from "viem";
import { Connector } from "wagmi";

export type ConnectorWithFilteredChains = {
  $filteredChains: Observable<Chain[]>;
};

export const isConnectorWithFilteredChains = (
  connector: Connector
): connector is Connector & ConnectorWithFilteredChains => {
  return !!(connector as unknown as ConnectorWithFilteredChains)
    .$filteredChains;
};
