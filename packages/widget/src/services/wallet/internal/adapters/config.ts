import type { Connection } from "@solana/web3.js";
import type { Chain, WalletList } from "@stakekit/rainbowkit";
import { Effect, Record } from "effect";
import type { Network } from "../../../../domain/network/network";
import type { VariantProps } from "../../../../public-api/react-types";
import { config } from "../../../../shared/config/widget-defaults";
import { WalletIntegrationError } from "../../wallet-errors";
import type { SolanaWalletDescriptor } from "../runtime/solana-runtime";
import { type MiscChainsMap, miscChainsMap } from "./configured-chains";

const queryFn = async ({
  buildConnectors,
  enabledNetworks,
  forceWalletConnectOnly,
  solanaWallets,
  solanaConnection,
  variant,
  tonConnectManifestUrl,
}: {
  buildConnectors: boolean;
  enabledNetworks: ReadonlySet<Network>;
  forceWalletConnectOnly: boolean;
  solanaWallets: ReadonlyArray<SolanaWalletDescriptor>;
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
  const filteredMiscChainsMap: Partial<MiscChainsMap> = Record.filter(
    miscChainsMap,
    (v) => enabledNetworks.has(v.network)
  );

  const miscChains = Object.values(filteredMiscChainsMap).map(
    (val) => val.wagmiChain
  );

  const connectors = buildConnectors
    ? await Promise.all([
        filteredMiscChainsMap.tron
          ? import("./tron/tron-connector").then((module) =>
              module.getTronConnectors({ forceWalletConnectOnly })
            )
          : null,
        filteredMiscChainsMap.solana && !config.env.isTestMode
          ? import("./solana/solana-connector").then((module) =>
              module.getSolanaConnectors({
                forceWalletConnectOnly,
                wallets: solanaWallets,
                connection: solanaConnection,
                variant,
              })
            )
          : null,
        filteredMiscChainsMap.cardano
          ? import("./cardano/cardano-connector").then((module) =>
              module.getCardanoConnectors()
            )
          : null,
        filteredMiscChainsMap.ton
          ? import("./ton/ton-connector").then((module) =>
              module.getTonConnectors({ tonConnectManifestUrl })
            )
          : null,
      ])
    : [null, null, null, null];
  return {
    miscChainsMap: filteredMiscChainsMap,
    miscChains,
    connectors,
  };
};

export const getConfig = (opts: Parameters<typeof queryFn>[0]) =>
  Effect.tryPromise({
    try: () => queryFn(opts),
    catch: (cause) =>
      new WalletIntegrationError({
        cause,
        message: "Could not get misc config",
        operation: "misc-config",
      }),
  });
