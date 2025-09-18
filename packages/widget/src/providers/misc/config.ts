import type { Wallet } from "@solana/wallet-adapter-react";
import type { Connection } from "@solana/web3.js";
import type { Networks } from "@stakekit/common";
import type { Chain, WalletList } from "@stakekit/rainbowkit";
import type { QueryClient } from "@tanstack/react-query";
import { EitherAsync, Maybe, MaybeAsync } from "purify-ts";
import { config } from "../../config";
import {
  type MiscChainsMap,
  miscChainsMap,
} from "../../domain/types/chains/misc";
import { typeSafeObjectEntries, typeSafeObjectFromEntries } from "../../utils";

const queryKey = [config.appPrefix, "misc-config"];
const staleTime = Number.POSITIVE_INFINITY;

const queryFn = async ({
  enabledNetworks,
  forceWalletConnectOnly,
  solanaWallets,
  solanaConnection,
}: {
  enabledNetworks: Set<Networks>;
  forceWalletConnectOnly: boolean;
  solanaWallets: Wallet[];
  solanaConnection: Connection;
}): Promise<{
  miscChainsMap: Partial<MiscChainsMap>;
  miscChains: Chain[];
  connectors: Maybe<{
    groupName: string;
    wallets: WalletList[number]["wallets"];
  }>[];
}> => {
  const miscChainsEntries = typeSafeObjectEntries<MiscChainsMap>(
    miscChainsMap
  ).filter(([_, v]) => enabledNetworks.has(v.skChainName));

  const filteredMiscChainsMap: Partial<MiscChainsMap> =
    typeSafeObjectFromEntries(miscChainsEntries);

  const miscChains = Object.values(filteredMiscChainsMap).map(
    (val) => val.wagmiChain
  );

  return Promise.all([
    MaybeAsync.liftMaybe(Maybe.fromFalsy(filteredMiscChainsMap.tron)).chain(
      () =>
        MaybeAsync(() => import("./tron-connector")).map((v) =>
          v.getTronConnectors({ forceWalletConnectOnly })
        )
    ),
    MaybeAsync.liftMaybe(
      Maybe.fromFalsy(filteredMiscChainsMap.solana && !config.env.isTestMode)
    ).chain(() =>
      MaybeAsync(() => import("./solana-connector")).map((v) =>
        v.getSolanaConnectors({
          forceWalletConnectOnly,
          wallets: solanaWallets,
          connection: solanaConnection,
        })
      )
    ),
  ]).then((connectors) => ({
    miscChainsMap: filteredMiscChainsMap,
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
