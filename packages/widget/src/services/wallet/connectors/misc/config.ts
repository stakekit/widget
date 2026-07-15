import type { Wallet } from "@solana/wallet-adapter-react";
import type { Connection } from "@solana/web3.js";
import type { Chain, WalletList } from "@stakekit/rainbowkit";
import { Effect } from "effect";
import type { Network } from "../../../../domain/schema/network-model";
import {
  type MiscChainsMap,
  miscChainsMap,
} from "../../../../domain/types/chains/misc";
import type { VariantProps } from "../../../../public-api/types";
import { config } from "../../../../shared/config/widget-defaults";
import {
  typeSafeObjectEntries,
  typeSafeObjectFromEntries,
} from "../../../../shared/lib/object";

const queryFn = async ({
  enabledNetworks,
  forceWalletConnectOnly,
  solanaWallets,
  solanaConnection,
  variant,
  tonConnectManifestUrl,
}: {
  enabledNetworks: ReadonlySet<Network>;
  forceWalletConnectOnly: boolean;
  solanaWallets: Wallet[];
  solanaConnection: Connection;
  variant: VariantProps["variant"];
  tonConnectManifestUrl: string | undefined;
}): Promise<{
  miscChainsMap: Partial<MiscChainsMap>;
  miscChains: Chain[];
  connectors: ({
    groupName: string;
    wallets: WalletList[number]["wallets"];
  } | null)[];
}> => {
  const miscChainsEntries = typeSafeObjectEntries<MiscChainsMap>(
    miscChainsMap
  ).filter(([_, v]) => enabledNetworks.has(v.skChainName));

  const filteredMiscChainsMap: Partial<MiscChainsMap> =
    typeSafeObjectFromEntries(miscChainsEntries);

  const miscChains = Object.values(filteredMiscChainsMap).map(
    (val) => val.wagmiChain
  );

  const connectors = await Promise.all([
    filteredMiscChainsMap.tron
      ? import("./tron-connector").then((module) =>
          module.getTronConnectors({ forceWalletConnectOnly })
        )
      : null,
    filteredMiscChainsMap.solana && !config.env.isTestMode
      ? import("./solana-connector").then((module) =>
          module.getSolanaConnectors({
            forceWalletConnectOnly,
            wallets: solanaWallets,
            connection: solanaConnection,
            variant,
          })
        )
      : null,
    filteredMiscChainsMap.cardano
      ? import("./cardano-connector").then((module) =>
          module.getCardanoConnectors()
        )
      : null,
    filteredMiscChainsMap.ton
      ? import("./ton-connector").then((module) =>
          module.getTonConnectors({ tonConnectManifestUrl })
        )
      : null,
  ]);
  return {
    miscChainsMap: filteredMiscChainsMap,
    miscChains,
    connectors,
  };
};

export const getConfig = (opts: Parameters<typeof queryFn>[0]) =>
  Effect.tryPromise({
    try: () => queryFn(opts),
    catch: (error) => new Error("Could not get misc config", { cause: error }),
  });
