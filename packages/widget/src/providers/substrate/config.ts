import { SubstrateNetworks } from "@stakekit/common";
import type { QueryClient } from "@tanstack/react-query";
import { EitherAsync } from "purify-ts";
import { config } from "../../config";
import type { SubstrateChainsMap } from "../../domain/types/chains";
import {
  isLedgerDappBrowserProvider,
  typeSafeObjectEntries,
  typeSafeObjectFromEntries,
} from "../../utils";
import { getEnabledNetworks } from "../api/get-enabled-networks";
import { polkadot } from "./chains";

const queryKey = [config.appPrefix, "substrate-config"];
const staleTime = Number.POSITIVE_INFINITY;

const queryFn = async ({
  queryClient,
}: {
  queryClient: QueryClient;
}) =>
  getEnabledNetworks({ queryClient }).caseOf({
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
