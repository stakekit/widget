import type { Chain as LunoKitChain } from "@luno-kit/core/chains";
import {
  type BaseConnector,
  subwalletConnector,
  talismanConnector,
  walletConnectConnector,
} from "@luno-kit/core/connectors";
import type { SignerPayloadJSON } from "@polkadot/types/types";
import { u8aToHex } from "@polkadot/util";
import type { WalletDetailsParams, WalletList } from "@stakekit/rainbowkit";
import { Array as EArray, Effect, Option, Stream } from "effect";
import type { Address } from "viem";
import { createConnector } from "wagmi";
import type { Chain } from "wagmi/chains";
import { config } from "../../../../../shared/config/widget-defaults";
import { WalletIntegrationError } from "../../../wallet-errors";
import { getWalletNetworkLogo } from "../../runtime/assets";
import {
  configMeta,
  type ExtraProps,
  type StorageItem,
} from "./substrate-connector-meta";

type EncodeSignedExtrinsic =
  typeof import("./extrinsic-encoding").encodeSignedExtrinsic;

const loadExtrinsicEncoder = Effect.tryPromise({
  try: (): Promise<EncodeSignedExtrinsic> =>
    import("./extrinsic-encoding").then(
      (module) => module.encodeSignedExtrinsic
    ),
  catch: (error) => error,
});

const createSubstrateConnector = ({
  id,
  name,
  type,
  baseConnector,
  encodeSignedExtrinsic,
  walletDetailsParams,
  chains,
  lunoKitChains,
}: {
  id: string;
  name: string;
  type: string;
  baseConnector: BaseConnector;
  encodeSignedExtrinsic: Effect.Effect<EncodeSignedExtrinsic, unknown>;
  walletDetailsParams: WalletDetailsParams;
  chains: ReadonlyArray<Chain>;
  lunoKitChains: LunoKitChain[];
}) =>
  createConnector<unknown, ExtraProps, StorageItem>((config) => {
    const filteredChains = chains as Chain[];
    const getFirstFilteredChain = () =>
      EArray.head(filteredChains).pipe(
        Option.getOrThrowWith(() => new Error("No supported chains found"))
      );

    return {
      ...walletDetailsParams,
      id,
      name,
      type,
      showQrModal: true,
      signTransaction: (payload: {
        tx: SignerPayloadJSON;
        metadataRpc: string;
      }) =>
        Effect.tryPromise({
          try: () => baseConnector.getSigner(),
          catch: (error) => error,
        }).pipe(
          Effect.flatMap((signer) => {
            const signPayload = signer?.signPayload?.bind(signer);

            if (!signPayload) {
              return Effect.fail(
                new WalletIntegrationError({
                  message: "signer missing",
                  operation: "substrate-sign",
                })
              );
            }

            return Effect.tryPromise({
              try: () =>
                signPayload({
                  ...payload.tx,
                  withSignedTransaction: true,
                }),
              catch: (error) => error,
            });
          }),
          Effect.flatMap((res) => {
            if (res.signedTransaction) {
              return Effect.succeed(
                typeof res.signedTransaction === "string"
                  ? res.signedTransaction
                  : u8aToHex(res.signedTransaction)
              );
            }

            return encodeSignedExtrinsic.pipe(
              Effect.flatMap((encode) =>
                Effect.try({
                  try: () =>
                    encode({
                      metadataRpc: payload.metadataRpc,
                      signature: res.signature,
                      tx: payload.tx,
                    }),
                  catch: (error) => error,
                })
              )
            );
          }),
          Effect.mapError(
            (cause) =>
              new WalletIntegrationError({
                cause,
                message: "Failed to sign transaction",
                operation: "substrate-sign",
              })
          )
        ),
      connect: async (args) => {
        config.emitter.emit("message", { type: "connecting" });

        baseConnector.once("get_uri", (uri: string) =>
          baseConnector.emit("display_uri", uri)
        );

        const accounts = await baseConnector.connect(name, lunoKitChains);

        if (!accounts || accounts.length === 0) {
          throw new Error("No accounts found");
        }

        config.storage?.removeItem("substrate.disconnected");
        config.storage?.setItem("substrate.lastConnectedId", baseConnector.id);

        return {
          accounts: args?.withCapabilities
            ? accounts.map((a) => ({ address: a.address, capabilities: {} }))
            : (accounts.map((a) => a.address) as Address[]),
          chainId: getFirstFilteredChain().id,
        } as never;
      },
      disconnect: () => {
        config.storage?.setItem("substrate.disconnected", true);
        config.storage?.removeItem("substrate.lastConnectedId");
        return baseConnector.disconnect();
      },
      getAccounts: () =>
        baseConnector
          .getAccounts()
          .then((acc) => acc.map((a) => a.address) as Address[]),
      switchChain: async (chain) => {
        const chainToSwitchTo = filteredChains.find(
          (c) => c.id === chain.chainId
        );

        if (!chainToSwitchTo) throw new Error("Chain not found");

        config.emitter.emit("change", { chainId: chain.chainId });

        return chainToSwitchTo;
      },
      getChainId: async () => getFirstFilteredChain().id,
      isAuthorized: async () => {
        const isDisconnected = await config.storage?.getItem(
          "substrate.disconnected"
        );

        if (isDisconnected) return false;

        const lastConnectedId = await config.storage?.getItem(
          "substrate.lastConnectedId"
        );

        return !!(lastConnectedId && lastConnectedId === baseConnector.id);
      },
      onAccountsChanged: (accounts: string[]) => {
        if (accounts.length === 0) {
          config.emitter.emit("disconnect");
        } else {
          config.emitter.emit("change", { accounts: accounts as Address[] });
        }
      },
      onChainChanged: (chainId) => {
        config.emitter.emit("change", {
          chainId: chainId as unknown as number,
        });
      },
      onDisconnect: () => {
        config.emitter.emit("disconnect");
      },
      getProvider: async () => baseConnector,
      $filteredChains: Stream.succeed(filteredChains),
    };
  });

export const getSubstrateConnectors = (
  chains: ReadonlyArray<Chain>,
  lunoKitChains: LunoKitChain[],
  forceWalletConnectOnly: boolean
): Effect.Effect<WalletList[number]> =>
  Effect.gen(function* () {
    const encodeSignedExtrinsic = yield* Effect.cached(loadExtrinsicEncoder);

    return buildSubstrateWalletGroup({
      chains,
      encodeSignedExtrinsic,
      forceWalletConnectOnly,
      lunoKitChains,
    });
  });

const buildSubstrateWalletGroup = ({
  chains,
  encodeSignedExtrinsic,
  forceWalletConnectOnly,
  lunoKitChains,
}: {
  chains: ReadonlyArray<Chain>;
  encodeSignedExtrinsic: Effect.Effect<EncodeSignedExtrinsic, unknown>;
  forceWalletConnectOnly: boolean;
  lunoKitChains: LunoKitChain[];
}): WalletList[number] => {
  const subwallet = subwalletConnector();
  const talisman = talismanConnector();
  const wc = walletConnectConnector({
    projectId: config.walletConnectV2.projectId,
  });

  const chainGroup = {
    iconUrl: getWalletNetworkLogo("polkadot"),
    title: "Substrate",
    id: "substrate",
  };

  const wcWallet: WalletList[number]["wallets"][number] = () => ({
    id: wc.id,
    name: wc.name,
    iconUrl: wc.icon,
    iconBackground: "#fff",
    chainGroup,
    installed: true,
    qrCode: { getUri: (uri) => uri },
    createConnector: (walletDetailsParams) => {
      const createConnectorFn = createSubstrateConnector({
        baseConnector: wc,
        encodeSignedExtrinsic,
        id: wc.id,
        name: wc.name,
        type: configMeta.type,
        walletDetailsParams,
        chains,
        lunoKitChains,
      });

      return (config) => {
        const connector = createConnectorFn(config);

        return {
          ...connector,
          ...walletDetailsParams,
          rkDetails: {
            ...walletDetailsParams.rkDetails,
            walletConnectModalConnector: connector,
          },
        };
      };
    },
  });

  return {
    groupName: "Substrate",
    wallets: forceWalletConnectOnly
      ? [wcWallet]
      : [
          wcWallet,
          () => ({
            id: talisman.id,
            name: talisman.name,
            iconUrl: talisman.icon,
            iconBackground: "#fff",
            chainGroup,
            installed: talisman.isInstalled(),
            downloadUrls: {
              browserExtension: talisman.links.browserExtension,
              chrome: talisman.links.browserExtension,
            },
            createConnector: (walletDetailsParams) =>
              createSubstrateConnector({
                baseConnector: talisman,
                encodeSignedExtrinsic,
                id: talisman.id,
                name: talisman.name,
                type: configMeta.type,
                walletDetailsParams,
                chains,
                lunoKitChains,
              }),
          }),
          () => ({
            id: subwallet.id,
            name: subwallet.name,
            iconUrl: subwallet.icon,
            iconBackground: "#fff",
            chainGroup,
            installed: subwallet.isInstalled(),
            downloadUrls: {
              browserExtension: subwallet.links.browserExtension,
              chrome: subwallet.links.browserExtension,
            },
            createConnector: (walletDetailsParams) =>
              createSubstrateConnector({
                baseConnector: subwallet,
                encodeSignedExtrinsic,
                id: subwallet.id,
                name: subwallet.name,
                type: configMeta.type,
                walletDetailsParams,
                chains,
                lunoKitChains,
              }),
          }),
        ],
  };
};
