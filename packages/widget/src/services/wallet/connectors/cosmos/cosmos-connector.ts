import { decodeSignature } from "@cosmjs/amino";
import { fromHex, toBase64, toHex } from "@cosmjs/encoding";
import type {
  ChainWalletBase,
  DirectSignDoc,
  MainWalletBase,
} from "@cosmos-kit/core";
import type { WCClient } from "@cosmos-kit/walletconnect";
import type { Wallet } from "@stakekit/rainbowkit";
import { SignDoc, TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { Array as EArray, Effect, Option, Schema, Stream } from "effect";
import EventEmitter from "eventemitter3";
import type { Address, Chain } from "viem";
import type { CreateConnectorFn } from "wagmi";
import { createConnector } from "wagmi";
import {
  WalletAddress,
  type WalletAddress as WalletAddressType,
} from "../../../../domain/schema/identifiers";
import type { CosmosChainsMap } from "../../../../domain/types/chains/cosmos";
import { CosmosNetworks } from "../../../../domain/types/chains/networks";
import { makeCurrentValueStream } from "../../../../shared/effect/current-value-stream";
import { getWalletNetworkLogo } from "../../assets";
import { waitForWalletDelay } from "../../delay";
import { WalletIntegrationError } from "../../domain/errors";
import type { ExtraProps } from "./cosmos-connector-meta";
import { configMeta } from "./cosmos-connector-meta";

const getCosmosWalletInstalled = (
  wallet: MainWalletBase
): boolean | undefined => {
  if (wallet.walletInfo.mode !== "extension") return undefined;

  return wallet.clientMutable.state === "Done" && !!wallet.client;
};

export const createCosmosConnector = ({
  wallet,
  cosmosChainsMap,
  cosmosWagmiChains,
  persistPublicKey,
}: {
  wallet: MainWalletBase;
  cosmosChainsMap: Partial<CosmosChainsMap>;
  cosmosWagmiChains: Chain[];
  persistPublicKey: (input: {
    readonly address: WalletAddressType;
    readonly publicKey: string;
  }) => Promise<void>;
}): Wallet => {
  const getDownloadLink = (index: number) =>
    EArray.get(wallet.walletInfo.downloads ?? [], index).pipe(
      Option.map((download) => download.link),
      Option.getOrUndefined
    );

  return {
    id: wallet.walletInfo.name,
    name: wallet.walletInfo.prettyName,
    iconUrl:
      (typeof wallet.walletInfo.logo === "string"
        ? wallet.walletInfo.logo
        : (wallet.walletInfo.logo?.major ?? wallet.walletInfo.logo?.minor)) ??
      "",
    iconBackground: "transparent",
    downloadUrls: {
      chrome: getDownloadLink(0),
      firefox: getDownloadLink(1),
      browserExtension: getDownloadLink(0),
    },
    qrCode: {
      getUri: (uri) => uri,
    },
    chainGroup: {
      iconUrl: getWalletNetworkLogo(CosmosNetworks.Cosmos),
      title: "Cosmos",
      id: "cosmos",
    },
    installed: getCosmosWalletInstalled(wallet),
    createConnector: (walletDetailsParams) =>
      createConnector<unknown, ExtraProps>((config) => {
        const provider = new EventEmitter();
        const initialChainName =
          cosmosChainsMap.cosmos?.chain.chain_name ??
          EArray.head(Object.values(cosmosChainsMap)).pipe(
            Option.map(({ chain }) => chain.chain_name),
            Option.getOrUndefined
          );
        const initCw = initialChainName
          ? wallet.chainWalletMap.get(initialChainName)
          : undefined;

        if (!initCw) throw new Error("Chain wallet not found");

        const chainWallet = makeCurrentValueStream<ChainWalletBase>(initCw);

        const setup: ReturnType<CreateConnectorFn>["setup"] = () =>
          new Promise((res, rej) => {
            let retryTimes = 0;

            const check = async () => {
              if (retryTimes > 3) {
                return rej();
              }

              if (
                initCw.clientMutable.state === "Done" ||
                initCw.clientMutable.state === "Error"
              ) {
                res();
              } else {
                await waitForWalletDelay(1000);
                retryTimes++;
                check();
              }
            };

            check();
          });

        const connect: ReturnType<CreateConnectorFn>["connect"] = async (
          args
        ) => {
          config.emitter.emit("message", { type: "connecting" });

          const cw = chainWallet.get();
          const getConnectResult = (chainWallet: ChainWalletBase) => {
            if (!chainWallet.address || !chainWallet.chainId) {
              throw new Error(
                chainWallet.message ?? "Cosmos wallet did not return an account"
              );
            }

            return {
              accounts: args?.withCapabilities
                ? [
                    {
                      address: chainWallet.address as Address,
                      capabilities: {},
                    },
                  ]
                : [chainWallet.address as Address],
              chainId: chainWallet.chainId as unknown as number,
            } as never;
          };

          if (cw.address && cw.chainId) {
            if (cw.walletInfo.mode === "wallet-connect") {
              await (cw.client as WCClient).init();
            }

            return getConnectResult(cw);
          }

          const checkForQRCode = async (timesCheck: number) => {
            if (timesCheck <= 0) return;

            await waitForWalletDelay(400);

            if (cw.qrUrl.data) {
              return provider.emit("display_uri", cw.qrUrl.data);
            }

            checkForQRCode(timesCheck - 1);
          };

          if (cw.walletInfo.mode === "wallet-connect") {
            checkForQRCode(20);
          }

          await cw.connect();

          const result = getConnectResult(cw);

          await getAndSavePubKeyToStorage();

          return result;
        };

        const getAndSavePubKeyToStorage = async () => {
          const cw = chainWallet.get();

          const result = await cw.client?.getAccount?.(cw.chainId);

          if (!result) return;

          const { address, pubkey } = result;

          await persistPublicKey({
            address: Schema.decodeSync(WalletAddress)(address),
            publicKey: toBase64(pubkey),
          });
        };

        const switchChain: ReturnType<CreateConnectorFn>["switchChain"] =
          async ({ chainId }) => {
            const wagmiChain = config.chains.find((c) => c.id === chainId);

            if (!wagmiChain) throw new Error("Chain not found");

            const cosmosChain = wagmiChain as Chain & {
              cosmosChainName: string;
            };

            const newCw = wallet.getChainWallet(
              cosmosChain.cosmosChainName
            ) as ChainWalletBase;

            if (!newCw) throw new Error("Chain wallet not found");

            chainWallet.set(newCw);

            await connect();

            const chain = config.chains.find((c) => c.id === chainId);

            if (!chain) throw new Error("Chain not found");

            onChainChanged(chainId.toString());
            onAccountsChanged([newCw.address as Address]);

            return chain;
          };

        const onAccountsChanged: ReturnType<CreateConnectorFn>["onAccountsChanged"] =
          (accounts) => {
            if (accounts.length === 0) {
              config.emitter.emit("disconnect");
            } else {
              config.emitter.emit("change", {
                accounts: accounts as Address[],
              });
            }
          };

        const onChainChanged: ReturnType<CreateConnectorFn>["onChainChanged"] =
          (chainId) => {
            config.emitter.emit("change", {
              chainId: chainId as unknown as number,
            });
          };

        const onDisconnect: ReturnType<CreateConnectorFn>["onDisconnect"] =
          () => {
            config.emitter.emit("disconnect");
          };

        const getAccounts: ReturnType<CreateConnectorFn>["getAccounts"] =
          async () => {
            const address = chainWallet.get().address;

            return address ? [address as Address] : [];
          };

        const isAuthorized: ReturnType<CreateConnectorFn>["isAuthorized"] =
          async () => {
            try {
              return !!chainWallet.get().address;
            } catch (_error) {
              return false;
            }
          };

        const signTransaction = ({
          cw,
          tx,
        }: {
          cw: ChainWalletBase;
          tx: string;
        }) =>
          Effect.tryPromise({
            try: () =>
              cw.client.signDirect!(
                cw.chainId,
                cw.address!,
                SignDoc.decode(fromHex(tx)) as unknown as DirectSignDoc // accountNumber bigint/Long issue
              ),
            catch: (cause) =>
              new WalletIntegrationError({
                cause,
                message: "signDirect failed",
                operation: "cosmos-sign-direct",
              }),
          }).pipe(
            Effect.map((val) =>
              toHex(
                TxRaw.encode({
                  authInfoBytes: val.signed.authInfoBytes,
                  bodyBytes: val.signed.bodyBytes,
                  signatures: [decodeSignature(val.signature).signature],
                }).finish()
              )
            )
          );

        const getChainId: ReturnType<CreateConnectorFn>["getChainId"] =
          async () => chainWallet.get().chainId as unknown as number;

        const getProvider: ReturnType<CreateConnectorFn>["getProvider"] =
          async () => provider;

        const disconnect: ReturnType<CreateConnectorFn>["disconnect"] =
          async () => chainWallet.get().disconnect();

        return {
          ...walletDetailsParams,
          setup,
          id: wallet.walletInfo.name,
          name: wallet.walletInfo.name,
          type: configMeta.type,
          $filteredChains: Stream.succeed(cosmosWagmiChains),
          $chainWallet: chainWallet.changes,
          connect,
          switchChain,
          onAccountsChanged,
          onChainChanged,
          onDisconnect,
          getAccounts,
          isAuthorized,
          getChainId,
          getProvider,
          disconnect,
          signTransaction,
          toBase64,
        };
      }),
  };
};
