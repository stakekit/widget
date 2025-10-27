import type { Chain as LunoKitChain } from "@luno-kit/core/chains";
import {
  type BaseConnector,
  subwalletConnector,
  talismanConnector,
  walletConnectConnector,
} from "@luno-kit/core/connectors";
import { TypeRegistry } from "@polkadot/types";
import type { SignerPayloadJSON } from "@polkadot/types/types";
import { u8aToHex } from "@polkadot/util";
import { SubstrateNetworks } from "@stakekit/common";
import type { WalletDetailsParams, WalletList } from "@stakekit/rainbowkit";
import { Either, EitherAsync, Maybe, Right } from "purify-ts";
import { BehaviorSubject } from "rxjs";
import type { Address } from "viem";
import { createConnector } from "wagmi";
import type { Chain } from "wagmi/chains";
import { config } from "../../config";
import { getStorageItem, setStorageItem } from "../../services/local-storage";
import { getNetworkLogo } from "../../utils";
import { configMeta, type ExtraProps } from "./substrate-connector-meta";

const createSubstrateConnector = ({
  id,
  name,
  type,
  baseConnector,
  walletDetailsParams,
  chains,
  lunoKitChains,
}: {
  id: string;
  name: string;
  type: string;
  baseConnector: BaseConnector;
  walletDetailsParams: WalletDetailsParams;
  chains: ReadonlyArray<Chain>;
  lunoKitChains: LunoKitChain[];
}) =>
  createConnector<unknown, ExtraProps>((config) => {
    const $filteredChains = new BehaviorSubject<Chain[]>(chains as Chain[]);

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
        EitherAsync(() => baseConnector.getSigner())
          .chain((signer) =>
            EitherAsync.liftEither(
              Maybe.fromNullable(signer?.signPayload?.bind(signer)).toEither(
                new Error("signer missing")
              )
            )
              .chain((signPayload) =>
                EitherAsync(() =>
                  signPayload({ ...payload.tx, withSignedTransaction: true })
                )
              )
              .chain((res) => {
                if (res.signedTransaction) {
                  return EitherAsync.liftEither(
                    Right(
                      typeof res.signedTransaction === "string"
                        ? res.signedTransaction
                        : u8aToHex(res.signedTransaction)
                    )
                  );
                }

                return EitherAsync.liftEither(
                  Either.encase(() => {
                    const registry = new TypeRegistry();

                    registry.setMetadata(
                      registry.createType("Metadata", payload.metadataRpc)
                    );

                    const extrinsic = registry.createType(
                      "Extrinsic",
                      { method: payload.tx.method },
                      { version: payload.tx.version }
                    );

                    extrinsic.addSignature(
                      payload.tx.address,
                      res.signature,
                      payload.tx
                    );

                    return u8aToHex(extrinsic.toU8a());
                  })
                );
              })
          )
          .mapLeft(
            (e) => new Error("Failed to sign transaction", { cause: e })
          ),
      connect: async () => {
        config.emitter.emit("message", { type: "connecting" });

        baseConnector.once("get_uri", (uri: string) =>
          baseConnector.emit("display_uri", uri)
        );

        const accounts = await baseConnector.connect(name, lunoKitChains);

        if (!accounts || accounts.length === 0)
          throw new Error("No accounts found");

        setStorageItem("sk-widget@1//shimDisconnect/substrate", true);
        setStorageItem(
          "sk-widget@1//substrateConnectors/lastConnectedId",
          baseConnector.id
        );

        return {
          accounts: accounts.map((a) => a.address) as Address[],
          chainId: $filteredChains.getValue()[0].id,
        };
      },
      disconnect: () => {
        setStorageItem("sk-widget@1//shimDisconnect/substrate", false);
        return baseConnector.disconnect();
      },
      getAccounts: () =>
        baseConnector
          .getAccounts()
          .then((acc) => acc.map((a) => a.address) as Address[]),
      switchChain: async (chain) => {
        const chainToSwitchTo = $filteredChains
          .getValue()
          .find((c) => c.id === chain.chainId);

        if (!chainToSwitchTo) throw new Error("Chain not found");

        config.emitter.emit("change", { chainId: chain.chainId });

        return chainToSwitchTo;
      },
      getChainId: async () => $filteredChains.getValue()[0].id,
      isAuthorized: async () => {
        const isAvailable = getStorageItem(
          "sk-widget@1//shimDisconnect/substrate"
        )
          .map((val) => !!val)
          .orDefault(false);

        if (!isAvailable) return false;

        return getStorageItem(
          "sk-widget@1//substrateConnectors/lastConnectedId"
        )
          .map((val) => val === baseConnector.id)
          .orDefault(false);
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
      $filteredChains: $filteredChains.asObservable(),
    };
  });

export const getSubstrateConnectors = (
  chains: ReadonlyArray<Chain>,
  lunoKitChains: LunoKitChain[],
  forceWalletConnectOnly: boolean
): WalletList[number] => {
  const subwallet = subwalletConnector();
  const talisman = talismanConnector();
  const wc = walletConnectConnector({
    projectId: config.walletConnectV2.projectId,
  });

  const chainGroup = {
    iconUrl: getNetworkLogo(SubstrateNetworks.Polkadot),
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
