import {
  isLedgerDappBrowserProvider,
  typeSafeObjectEntries,
  typeSafeObjectFromEntries,
} from "../../utils";
import { SubstrateChainsMap } from "../../domain/types/chains";
import { SubstrateNetworks } from "@stakekit/common";
import { getEnabledNetworks } from "../api/get-enabled-networks";
import { config } from "../../config";
import { EitherAsync } from "purify-ts";
import { polkadot } from "./chains";
import { QueryClient } from "@tanstack/react-query";

const queryKey = [config.appPrefix, "substrate-config"];
const staleTime = Infinity;

const queryFn = async ({ queryClient }: { queryClient: QueryClient }) =>
  getEnabledNetworks(queryClient).caseOf({
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

export const getConfig = ({ queryClient }: { queryClient: QueryClient }) =>
  EitherAsync(() =>
    queryClient.fetchQuery({
      staleTime,
      queryKey,
      queryFn: () => queryFn({ queryClient }),
    })
  ).mapLeft((e) => {
    console.log(e);
    return new Error("Could not get substrate config");
  });
