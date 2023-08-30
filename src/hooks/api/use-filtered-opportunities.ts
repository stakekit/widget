import { useOpportunities } from "./use-opportunities";
import { useSKWallet } from "../wallet/use-sk-wallet";
import { YieldOpportunityDto } from "@stakekit/api-hooks";
import { createSelector } from "reselect";
import { SKWallet } from "../../domain/types";
import { useAllEnabledOpportunities } from "./use-all-enabled-opportunities";

type SelectorInputData = {
  data: YieldOpportunityDto[];
  isConnected: boolean;
  network: SKWallet["network"];
};

/**
 *
 * @summary Opportunities with default filter applied
 */
export const useFilteredOpportunities = () => {
  const { network, isConnected } = useSKWallet();

  return useOpportunities({
    query: {
      select: (data) => defaultFiltered({ data, isConnected, network }),
      staleTime: 1000 * 60 * 5,
    },
  });
};

/**
 *
 * @summary Opportunities with default and staking enabled filter applied
 */
export const useStakeEnterEnabledOpportunities = () => {
  const { network, isConnected } = useSKWallet();

  return useOpportunities({
    query: {
      select: (data) =>
        stakeEnterEnabledFiltered({ data, isConnected, network }),
    },
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
    staleTime: 1000 * 60 * 5,
    ...opts,
  });
};

const skFilter = ({
  o,
  isConnected,
  network,
}: {
  o: YieldOpportunityDto;
  isConnected: boolean;
  network: SKWallet["network"];
}) => {
  const defaultFilter =
    !o.args.enter.args?.nfts &&
    o.id !== "binance-bnb-native-staking" &&
    o.id !== "binance-testnet-bnb-native-staking";

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
  (data, isConnected, network) =>
    data.filter((o) => skFilter({ o, isConnected, network }))
);

const stakeEnterEnabledFiltered = createSelector(
  selectData,
  selectConnected,
  selectNetwork,
  (data, isConnected, network) =>
    data.filter((o) => skFilter({ o, isConnected, network }) && o.status.enter)
);
