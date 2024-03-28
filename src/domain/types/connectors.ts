import { Chain } from "viem";
import { Connector } from "wagmi";
import { Observable } from "../../utils/observable";

export type ConnectorWithFilteredChains = {
  $filteredChains: Observable<Chain[]>;
};

export const isConnectorWithFilteredChains = (
  connector: Connector
): connector is Connector & ConnectorWithFilteredChains => {
  return !!(connector as unknown as ConnectorWithFilteredChains)
    .$filteredChains;
};
