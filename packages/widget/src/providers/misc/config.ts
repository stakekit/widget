import type { Networks } from "@stakekit/common";
import { MiscNetworks } from "@stakekit/common";
import type { Chain, WalletList } from "@stakekit/rainbowkit";
import type { QueryClient } from "@tanstack/react-query";
import { EitherAsync, Maybe, MaybeAsync } from "purify-ts";
import { config } from "../../config";
import type { MiscChainsMap } from "../../domain/types/chains";
import { typeSafeObjectEntries, typeSafeObjectFromEntries } from "../../utils";
import { near, solana, tezos, ton, tron } from "./chains";

const queryKey = [config.appPrefix, "misc-config"];
const staleTime = Number.POSITIVE_INFINITY;

const queryFn = async ({
  enabledNetworks,
  forceWalletConnectOnly,
}: {
  enabledNetworks: Set<Networks>;
  forceWalletConnectOnly: boolean;
}): Promise<{
  miscChainsMap: Partial<MiscChainsMap>;
  miscChains: Chain[];
  connectors: Maybe<{
    groupName: string;
    wallets: WalletList[number]["wallets"];
  }>[];
}> => {
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
    [MiscNetworks.Ton]: {
      type: "misc",
      skChainName: MiscNetworks.Ton,
      wagmiChain: ton,
    },
  }).filter(([_, v]) => enabledNetworks.has(v.skChainName));

  const miscChainsMap: Partial<MiscChainsMap> =
    typeSafeObjectFromEntries(miscChainsEntries);

  const miscChains = Object.values(miscChainsMap).map((val) => val.wagmiChain);

  return Promise.all([
    MaybeAsync.liftMaybe(Maybe.fromFalsy(miscChainsMap.tron)).chain(() =>
      MaybeAsync(() => import("./tron-connector")).map((v) =>
        v.getTronConnectors({ forceWalletConnectOnly })
      )
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
