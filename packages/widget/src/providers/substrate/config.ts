import type { QueryClient } from "@tanstack/react-query";
import { EitherAsync } from "purify-ts";
import { config } from "../../config";
import {
  type SubstrateChainsMap,
  substrateChainsMap,
} from "../../domain/types/chains/substrate";
import { typeSafeObjectEntries, typeSafeObjectFromEntries } from "../../utils";
import { getEnabledNetworks } from "../api/get-enabled-networks";

const queryKey = [config.appPrefix, "substrate-config"];
const staleTime = Number.POSITIVE_INFINITY;

const queryFn = async ({
  queryClient,
}: {
  queryClient: QueryClient;
}) =>
  getEnabledNetworks({ queryClient }).caseOf({
    Right: (networks) => {
      const filteredSubstrateChainsMap: Partial<SubstrateChainsMap> =
        typeSafeObjectFromEntries(
          typeSafeObjectEntries<SubstrateChainsMap>(substrateChainsMap).filter(
            ([_, v]) => networks.has(v.skChainName)
          )
        );

      const substrateChains = Object.values(filteredSubstrateChainsMap).map(
        (val) => val.wagmiChain
      );

      return Promise.resolve({
        substrateChainsMap: filteredSubstrateChainsMap,
        substrateChains,
      });
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
