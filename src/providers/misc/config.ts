import { typeSafeObjectEntries, typeSafeObjectFromEntries } from "../../utils";
import type { MiscChainsMap } from "../../domain/types/chains";
import type { Networks } from "@stakekit/common";
import { MiscNetworks } from "@stakekit/common";
import { config } from "../../config";
import { EitherAsync, Maybe, MaybeAsync } from "purify-ts";
import { near, solana, tezos, tron } from "./chains";
import type { QueryClient } from "@tanstack/react-query";

const queryKey = [config.appPrefix, "misc-config"];
const staleTime = Infinity;

const queryFn = async ({
  enabledNetworks,
}: {
  enabledNetworks: Set<Networks>;
}) => {
  const miscChainsEntries = typeSafeObjectEntries<MiscChainsMap>({
    [MiscNetworks.Near]: {
      type: "misc",
      skChainName: MiscNetworks.Near,
      wagmiChain: near,
    },
    [MiscNetworks.Tezos]: {
      type: "misc",
      skChainName: MiscNetworks.Tezos,
      wagmiChain: tezos,
    },
    [MiscNetworks.Solana]: {
      type: "misc",
      skChainName: MiscNetworks.Solana,
      wagmiChain: solana,
    },
    [MiscNetworks.Tron]: {
      type: "misc",
      skChainName: MiscNetworks.Tron,
      wagmiChain: tron,
    },
  }).filter(([_, v]) => enabledNetworks.has(v.skChainName));

  const miscChainsMap: Partial<MiscChainsMap> =
    typeSafeObjectFromEntries(miscChainsEntries);

  const miscChains = Object.values(miscChainsMap).map((val) => val.wagmiChain);

  return Promise.all([
    MaybeAsync.liftMaybe(Maybe.fromFalsy(miscChainsMap.tron)).chain(() =>
      MaybeAsync(() => import("./tron-connector")).map((v) => v.tronConnector)
    ),
  ]).then((connectors) => ({
    miscChainsMap,
    miscChains,
    connectors,
  }));
};

export const getConfig = (
  opts: Parameters<typeof queryFn>[0] & { queryClient: QueryClient }
) =>
  EitherAsync(() =>
    opts.queryClient.fetchQuery({
      staleTime,
      queryKey,
      queryFn: () => queryFn(opts),
    })
  ).mapLeft((e) => {
    console.log(e);
    return new Error("Could not get misc config");
  });
