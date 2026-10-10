import { decodeSignature } from "@cosmjs/amino";
import { fromHex, toBase64, toHex } from "@cosmjs/encoding";
import { SignDoc, TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { Array as EArray, Effect, Option, Schema, Stream } from "effect";
import type { Address, Chain } from "viem";
import type { CreateConnectorFn } from "wagmi";
import { createConnector } from "wagmi";
import {
  WalletAddress,
  type WalletAddress as WalletAddressType,
} from "../../../../../domain/identity/identifiers";
import { makeCurrentValueStream } from "../../../../../shared/effect/current-value-stream";
import type {
  WalletAvailability,
  WalletDescriptor,
} from "../../../wallet-descriptors";
import { WalletIntegrationError } from "../../../wallet-errors";
import { getWalletNetworkLogo } from "../../runtime/assets";
import type { RunWalletEffect } from "../../runtime/effect-runner";
import { wagmiConnectResult } from "../wagmi-connect-result";
import { makeWagmiConnectorEvents } from "../wagmi-connector-events";
import type { CosmosChainsAssets, CosmosChainsMap } from "./chains";
import type { CosmosChainWallet, ExtraProps } from "./cosmos-connector-meta";
import { configMeta } from "./cosmos-connector-meta";

export type CosmosWalletConnection = Readonly<{
  address: string;
  wallet: CosmosChainWallet;
}>;

export const cosmosWalletConnectStorageKey = "cosmos.walletConnect" as const;

export const CosmosWalletConnectRecord = Schema.Struct({
  connectorId: Schema.String,
  topic: Schema.String,
  chainId: Schema.String,
  address: Schema.String,
});

/** The chain an extension wallet last connected on, restored after reload. */
export const cosmosExtensionChainStorageKey = "cosmos.extensionChain" as const;

export const CosmosExtensionChainRecord = Schema.Struct({
  connectorId: Schema.String,
  chainId: Schema.String,
});

export type CosmosStorage = {
  [cosmosWalletConnectStorageKey]: typeof CosmosWalletConnectRecord.Type;
  [cosmosExtensionChainStorageKey]: typeof CosmosExtensionChainRecord.Type;
};

export type CosmosConnectorStorage = Parameters<
  CreateConnectorFn<unknown, ExtraProps, CosmosStorage>
>[0]["storage"];

/** One wallet's connection lifecycle, bound to a single wagmi connector. */
export type CosmosWalletSession = Readonly<{
  /** Resolves once the wallet can be asked to connect. */
  ready: () => Promise<void>;
  connect: (chain: CosmosChainsAssets) => Promise<CosmosWalletConnection>;
  /**
   * Restores the persisted connection, on the chain it was made on, without
   * prompting; rejects when nothing restorable exists.
   */
  restore: () => Promise<CosmosWalletConnection>;
  isAuthorized: () => Promise<boolean>;
  disconnect: (chain: CosmosChainsAssets) => Promise<void>;
}>;

export type CosmosWallet = Readonly<{
  id: string;
  name: string;
  iconUrl: string;
  availability: WalletAvailability;
  makeSession: (
    input: Readonly<{
      connectorId: string;
      storage: CosmosConnectorStorage;
      /** The wallet ended the connection. */
      onEnded: () => void;
    }>
  ) => CosmosWalletSession;
}>;

const cosmosWagmiChainId = (chainId: string) => chainId as unknown as number;

export const createCosmosConnector = ({
  wallet,
  cosmosChainsMap,
  cosmosWagmiChains,
  persistPublicKey,
  runWalletEffect,
}: {
  wallet: CosmosWallet;
  cosmosChainsMap: Partial<CosmosChainsMap>;
  cosmosWagmiChains: Chain[];
  runWalletEffect: RunWalletEffect;
  persistPublicKey: (input: {
    readonly address: WalletAddressType;
    readonly publicKey: string;
  }) => Promise<void>;
}): WalletDescriptor => ({
  id: wallet.id,
  name: wallet.name,
  iconUrl: wallet.iconUrl,
  iconBackground: "transparent",
  availability: wallet.availability,
  chainGroup: {
    iconUrl: getWalletNetworkLogo("cosmos"),
    title: "Cosmos",
    id: "cosmos",
  },
  createConnector: (walletDetailsParams) =>
    createConnector<unknown, ExtraProps, CosmosStorage>((config) => {
      const chains = Object.values(cosmosChainsMap).map(({ chain }) => chain);
      const initialChain =
        cosmosChainsMap.cosmos?.chain ??
        EArray.head(chains).pipe(Option.getOrUndefined);

      if (!initialChain) throw new Error("Cosmos chain not found");

      let currentChain = initialChain;
      let connection: CosmosWalletConnection | null = null;
      const chainWallet = makeCurrentValueStream<CosmosChainWallet | null>(
        null
      );

      const setConnection = (next: CosmosWalletConnection | null) => {
        connection = next;
        chainWallet.set(next?.wallet ?? null);
      };

      const session = wallet.makeSession({
        connectorId: wallet.id,
        storage: config.storage,
        onEnded: () => {
          setConnection(null);
          config.emitter.emit("disconnect");
        },
      });

      const persistAccountPublicKey = async (signer: CosmosChainWallet) => {
        const { address, pubkey } = await runWalletEffect(signer.getAccount);

        await persistPublicKey({
          address: Schema.decodeSync(WalletAddress)(address),
          publicKey: toBase64(pubkey),
        });
      };

      const connect: ReturnType<CreateConnectorFn>["connect"] = async (
        args
      ) => {
        config.emitter.emit("message", { type: "connecting" });

        const next = args?.isReconnecting
          ? await session.restore()
          : await session.connect(
              // The host's initial chain, when it is one of this connector's chains.
              chains.find(
                (chain) => cosmosWagmiChainId(chain.chain_id) === args?.chainId
              ) ?? currentChain
            );
        currentChain =
          chains.find((chain) => chain.chain_id === next.wallet.chainId) ??
          currentChain;
        setConnection(next);

        if (!args?.isReconnecting) await persistAccountPublicKey(next.wallet);

        return wagmiConnectResult(
          args?.withCapabilities,
          [next.address as Address],
          cosmosWagmiChainId(next.wallet.chainId)
        );
      };

      const switchChain: ReturnType<CreateConnectorFn>["switchChain"] = async ({
        chainId,
      }) => {
        const wagmiChain = config.chains.find((c) => c.id === chainId);
        const chain = chains.find(
          (chain) => cosmosWagmiChainId(chain.chain_id) === chainId
        );

        if (!wagmiChain || !chain) throw new Error("Chain not found");

        const next = await session.connect(chain);
        currentChain = chain;
        setConnection(next);
        await persistAccountPublicKey(next.wallet);

        onChainChanged(chainId.toString());
        onAccountsChanged([next.address as Address]);

        return wagmiChain;
      };

      const { onAccountsChanged, onChainChanged, onDisconnect } =
        makeWagmiConnectorEvents(config.emitter, cosmosWagmiChainId);

      const signTransaction = ({
        cw,
        tx,
      }: {
        cw: CosmosChainWallet;
        tx: string;
      }) =>
        Effect.try({
          try: () => SignDoc.decode(fromHex(tx)),
          catch: (cause) =>
            new WalletIntegrationError({
              cause,
              message: "Invalid Cosmos sign document",
              operation: "cosmos-sign-direct",
            }),
        }).pipe(
          Effect.flatMap(cw.signDirect),
          Effect.flatMap((response) =>
            Effect.try({
              // The wallet may modify the document; encode what it signed.
              try: () =>
                toHex(
                  TxRaw.encode({
                    authInfoBytes: response.signed.authInfoBytes,
                    bodyBytes: response.signed.bodyBytes,
                    signatures: [decodeSignature(response.signature).signature],
                  }).finish()
                ),
              catch: (cause) =>
                new WalletIntegrationError({
                  cause,
                  message: "Invalid Cosmos signature",
                  operation: "cosmos-sign-direct",
                }),
            })
          )
        );

      return {
        ...walletDetailsParams,
        setup: () => session.ready(),
        id: wallet.id,
        name: wallet.id,
        type: configMeta.type,
        $filteredChains: Stream.succeed(cosmosWagmiChains),
        $chainWallet: chainWallet.changes,
        connect,
        switchChain,
        onAccountsChanged,
        onChainChanged,
        onDisconnect,
        getAccounts: async () =>
          connection ? [connection.address as Address] : [],
        isAuthorized: async () => {
          try {
            return await session.isAuthorized();
          } catch {
            return false;
          }
        },
        getChainId: async () => cosmosWagmiChainId(currentChain.chain_id),
        getProvider: async () => ({}),
        disconnect: async () => {
          setConnection(null);
          await session.disconnect(currentChain);
        },
        signTransaction,
        toBase64,
      };
    }),
});
