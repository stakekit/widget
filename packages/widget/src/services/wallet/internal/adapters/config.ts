import type { Connection } from "@solana/web3.js";
import { Effect, Record } from "effect";
import type { Network } from "../../../../domain/network/network";
import type { VariantProps } from "../../../../public-api/react-types";
import { config } from "../../../../shared/config/widget-defaults";
import type { Chain, WalletList } from "../../wallet-descriptors";
import { WalletIntegrationError } from "../../wallet-errors";
import type { WalletModal } from "../../wallet-modal";
import type { StellarWalletsKitPlatformService } from "../platform/stellar-wallets-kit-platform";
import type { WalletConnectProtocol } from "../platform/wallet-connect-protocol";
import type { RunWalletEffect } from "../runtime/effect-runner";
import type { SolanaWalletDescriptor } from "../runtime/solana-runtime";
import { type MiscChainsMap, miscChainsMap } from "./configured-chains";
import { loadStellarConnector } from "./stellar/config";

const queryFn = async ({
  buildConnectors,
  enabledNetworks,
  solanaWallets,
  solanaConnection,
  variant,
  tonConnectManifestUrl,
  stellarConnector,
  walletConnectProtocol,
  runWalletEffect,
  walletModal,
}: {
  buildConnectors: boolean;
  enabledNetworks: ReadonlySet<Network>;
  solanaWallets: ReadonlyArray<SolanaWalletDescriptor>;
  solanaConnection: Connection;
  variant: VariantProps["variant"];
  tonConnectManifestUrl: string | undefined;
  stellarConnector: WalletList[number] | null;
  readonly walletConnectProtocol: WalletConnectProtocol;
  readonly runWalletEffect: RunWalletEffect;
  readonly walletModal: WalletModal["Service"];
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
    (value) =>
      enabledNetworks.has(value.network) &&
      (value.protocolFamily !== "stellar" || buildConnectors)
  );

  const miscChains = Object.values(filteredMiscChainsMap).map(
    (val) => val.wagmiChain
  );

  const connectors = buildConnectors
    ? await Promise.all([
        filteredMiscChainsMap.tron
          ? import("./tron/tron-connector").then((module) =>
              module.getTronConnectors({
                walletConnectProtocol,
                runWalletEffect,
              })
            )
          : null,
        filteredMiscChainsMap.solana && !config.env.isTestMode
          ? import("./solana/solana-connector").then((module) =>
              module.getSolanaConnectors({
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
              module.getTonConnectors({
                runWalletEffect,
                tonConnectManifestUrl,
                walletModal,
              })
            )
          : null,
        stellarConnector,
      ])
    : [null, null, null, null, null];
  return {
    miscChainsMap: filteredMiscChainsMap,
    miscChains,
    connectors,
  };
};

type GetConfigOptions = Omit<
  Parameters<typeof queryFn>[0],
  "stellarConnector"
> & {
  readonly stellarWalletsKitPlatform: StellarWalletsKitPlatformService;
  readonly runWalletEffect: RunWalletEffect;
};

export const getConfig = Effect.fn("getMiscWalletConfig")(function* (
  opts: GetConfigOptions
) {
  const stellarConnector = yield* loadStellarConnector(opts);
  return yield* Effect.tryPromise({
    try: () => queryFn({ ...opts, stellarConnector }),
    catch: (cause) =>
      new WalletIntegrationError({
        cause,
        message: "Could not get misc config",
        operation: "misc-config",
      }),
  });
});
