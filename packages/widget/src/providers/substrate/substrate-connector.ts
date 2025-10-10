import {
  type BaseConnector,
  // polkadotjsConnector,
  subwalletConnector,
  // talismanConnector,
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
}: {
  id: string;
  name: string;
  type: string;
  baseConnector: BaseConnector;
  walletDetailsParams: WalletDetailsParams;
  chains: ReadonlyArray<Chain>;
}) =>
  createConnector<unknown, ExtraProps>((config) => {
    const $filteredChains = new BehaviorSubject<Chain[]>(chains as Chain[]);

    return {
      ...walletDetailsParams,
      id,
      name,
      type,
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

        const accounts = await baseConnector.connect(name);

        if (!accounts || accounts.length === 0)
          throw new Error("No accounts found");

        setStorageItem("sk-widget@1//shimDisconnect/substrate", true);

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
      isAuthorized: async () =>
        getStorageItem("sk-widget@1//shimDisconnect/substrate")
          .map((val) => !!(val && baseConnector.isInstalled()))
          .orDefault(false),
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
      getProvider: async () => ({}),
      $filteredChains: $filteredChains.asObservable(),
    };
  });

export const getSubstrateConnectors = (
  chains: ReadonlyArray<Chain>
): WalletList[number] => {
  const subwallet = subwalletConnector();
  // const polkadotjs = polkadotjsConnector();
  // const talisman = talismanConnector();

  const chainGroup = {
    iconUrl: getNetworkLogo(SubstrateNetworks.Polkadot),
    title: "Substrate",
    id: "substrate",
  };

  return {
    groupName: "Substrate",
    wallets: [
      // () => ({
      //   id: polkadotjs.id,
      //   name: polkadotjs.name,
      //   iconUrl: polkadotjs.icon,
      //   iconBackground: "#fff",
      //   chainGroup,
      //   installed: polkadotjs.isInstalled(),
      //   downloadUrls: {
      //     browserExtension: polkadotjs.links.browserExtension,
      //     chrome: polkadotjs.links.browserExtension,
      //   },
      //   createConnector: (walletDetailsParams) =>
      //     createSubstrateConnector({
      //       baseConnector: polkadotjs,
      //       id: polkadotjs.id,
      //       name: polkadotjs.name,
      //       type: configMeta.type,
      //       walletDetailsParams,
      //       chains,
      //     }),
      // }),
      // () => ({
      //   id: talisman.id,
      //   name: talisman.name,
      //   iconUrl: talisman.icon,
      //   iconBackground: "#fff",
      //   chainGroup,
      //   installed: talisman.isInstalled(),
      //   createConnector: (walletDetailsParams) =>
      //     createSubstrateConnector({
      //       baseConnector: talisman,
      //       id: talisman.id,
      //       name: talisman.name,
      //       type: configMeta.type,
      //       walletDetailsParams,
      //       chains,
      //     }),
      // }),
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
          }),
      }),
    ],
  };
};
