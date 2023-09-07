import { useSKWallet } from "../../wallet/use-sk-wallet";
import { YieldDto } from "@stakekit/api-hooks";
import { createSelector } from "reselect";
import { SKWallet } from "../../../domain/types";
import { useAllEnabledOpportunities } from "./use-all-enabled-opportunities";
import {
  SupportedSKChains,
  isSupportedChain,
} from "../../../domain/types/chains";
import { CosmosNetworks, EvmNetworks } from "@stakekit/common";

type SelectorInputData = {
  data: YieldDto[];
  isConnected: boolean;
  network: SKWallet["network"];
};

/**
 *
 * @summary Opportunities with default and staking enabled filter applied
 */
export const useStakeEnterEnabledOpportunities = () => {
  const { network, isConnected } = useSKWallet();

  return useAllEnabledOpportunities({
    select: (data) => stakeEnterEnabledFiltered({ data, isConnected, network }),
  });
};

/**
 *
 * @summary Get all enabled opportunities with default filter applied
 */
export const useEnabledFilteredOpportunities = (
  opts?: Parameters<typeof useAllEnabledOpportunities>[0]
) => {
  const { network, isConnected } = useSKWallet();

  return useAllEnabledOpportunities({
    select: (data) => defaultFiltered({ data, isConnected, network }),
    ...opts,
  });
};

const skFilter = ({
  o,
  isConnected,
  network,
}: {
  o: YieldDto;
  isConnected: boolean;
  network: SKWallet["network"];
}) => {
  const defaultFilter =
    !o.args.enter.args?.nfts &&
    o.id !== "binance-bnb-native-staking" &&
    o.id !== "binance-testnet-bnb-native-staking" &&
    isSupportedChain(o.token.network);

  if (!isConnected) return defaultFilter;

  return network === o.token.network && defaultFilter;
};

const selectData = (val: SelectorInputData) => val.data;
const selectConnected = (val: SelectorInputData) => val.isConnected;
const selectNetwork = (val: SelectorInputData) => val.network;

const defaultFiltered = createSelector(
  selectData,
  selectConnected,
  selectNetwork,
  (data, isConnected, network) => {
    const fn = (o: YieldDto) => skFilter({ o, isConnected, network });

    if (isConnected) {
      return data.filter(fn);
    }

    return data
      .slice()
      .sort(
        (a, b) =>
          getOrder(a.token.network as SupportedSKChains) -
          getOrder(b.token.network as SupportedSKChains)
      )
      .filter(fn);
  }
);

const stakeEnterEnabledFiltered = createSelector(
  selectData,
  selectConnected,
  selectNetwork,
  (data, isConnected, network) => {
    const fn = (o: YieldDto) =>
      skFilter({ o, isConnected, network }) && o.status.enter;

    if (isConnected) {
      return data.filter(fn);
    }

    return data
      .slice()
      .sort(
        (a, b) =>
          getOrder(a.token.network as SupportedSKChains) -
          getOrder(b.token.network as SupportedSKChains)
      )
      .filter(fn);
  }
);

const getOrder = (() => {
  const sortOrder = new Map<SupportedSKChains, number>([
    [CosmosNetworks.Cosmos, 1],
    [CosmosNetworks.Juno, 2],
    [CosmosNetworks.Osmosis, 3],
    [CosmosNetworks.Akash, 4],
    [CosmosNetworks.Stargaze, 5],
    [CosmosNetworks.Kava, 6],
    [EvmNetworks.Polygon, 7],
    [EvmNetworks.AvalancheC, 8],
    [EvmNetworks.Ethereum, 9],
    [EvmNetworks.Optimism, 10],
  ]);

  return (network: SupportedSKChains) => sortOrder.get(network) ?? 999;
})();
