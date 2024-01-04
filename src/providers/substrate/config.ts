import {
  isLedgerDappBrowserProvider,
  typeSafeObjectEntries,
  typeSafeObjectFromEntries,
} from "../../utils";
import { SubstrateChainsMap } from "../../domain/types/chains";
import { SubstrateNetworks } from "@stakekit/common";
import { queryClient } from "../../services/query-client";
import { getEnabledNetworks } from "../api/get-enabled-networks";
import { config } from "../../config";
import { EitherAsync } from "purify-ts";
import { polkadot } from "./chains";

const queryKey = [config.appPrefix, "substrate-config"];
const staleTime = Infinity;

const queryFn = async () =>
  getEnabledNetworks().caseOf({
    Right: (networks) => {
      const substrateChainsMap: Partial<SubstrateChainsMap> =
        typeSafeObjectFromEntries(
          typeSafeObjectEntries<SubstrateChainsMap>({
            [SubstrateNetworks.Polkadot]: {
              type: "substrate",
              skChainName: SubstrateNetworks.Polkadot,
              wagmiChain: polkadot,
            },
          }).filter(([_, v]) => networks.has(v.skChainName))
        );

      const substrateChains = isLedgerDappBrowserProvider()
        ? Object.values(substrateChainsMap).map((val) => val.wagmiChain)
        : [];

      return Promise.resolve({ substrateChainsMap, substrateChains });
    },
    Left: (l) => Promise.reject(l),
  });

export const getConfig = () =>
  EitherAsync(() =>
    queryClient.fetchQuery({ staleTime, queryKey, queryFn })
  ).mapLeft((e) => {
    console.log(e);
    return new Error("Could not get substrate config");
  });
