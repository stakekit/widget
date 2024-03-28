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
import { useYieldGetMyNetworksHook } from "@stakekit/api-hooks";

const queryKey = [config.appPrefix, "substrate-config"];
const staleTime = Infinity;

const queryFn = async ({
  queryClient,
  yieldGetMyNetworks,
}: {
  queryClient: QueryClient;
  yieldGetMyNetworks: ReturnType<typeof useYieldGetMyNetworksHook>;
}) =>
  getEnabledNetworks({ queryClient, yieldGetMyNetworks }).caseOf({
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

export const getConfig = (opts: Parameters<typeof queryFn>[0]) =>
  EitherAsync(() =>
    opts.queryClient.fetchQuery({
      staleTime,
      queryKey,
      queryFn: () => queryFn(opts),
    })
  ).mapLeft((e) => {
    console.log(e);
    return new Error("Could not get substrate config");
  });
