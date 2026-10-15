import {
  type BaseConnector,
  subwalletConnector,
  talismanConnector,
} from "@luno-kit/core/connectors";
import type { SignerPayloadJSON } from "@polkadot/types/types";
import { u8aToHex } from "@polkadot/util";
import { Array as EArray, Effect, Option, Stream } from "effect";
import type { Address } from "viem";
import { createConnector } from "wagmi";
import type { Chain } from "wagmi/chains";
import type {
  WalletAvailability,
  WalletDetailsParams,
  WalletList,
} from "../../../wallet-descriptors";
import {
  WalletIntegrationError,
  WalletNotAvailableError,
} from "../../../wallet-errors";
import type { WalletConnectProtocol } from "../../platform/wallet-connect-protocol";
import { getWalletNetworkLogo } from "../../runtime/assets";
import type { RunWalletEffect } from "../../runtime/effect-runner";
import walletConnectIcon from "../evm/icons/wallet-connect.svg";
import { wagmiConnectResult } from "../wagmi-connect-result";
import { makeWagmiConnectorEvents } from "../wagmi-connector-events";
import type { SubstrateChain } from "./chains";
import type { encodeSignedExtrinsic } from "./extrinsic-encoding";
import {
  configMeta,
  type ExtraProps,
  type StorageItem,
  type SubstrateWallet,
} from "./substrate-connector-meta";
import { makeSubstrateWalletConnect } from "./substrate-wallet-connect";

type EncodeSignedExtrinsic = typeof encodeSignedExtrinsic;

const substrateSigningError = (cause: unknown) =>
  new WalletIntegrationError({
    cause,
    message: "Failed to sign transaction",
    operation: "substrate-sign",
  });

const loadExtrinsicEncoder = Effect.tryPromise({
  try: (): Promise<EncodeSignedExtrinsic> =>
    import("./extrinsic-encoding").then(
      (module) => module.encodeSignedExtrinsic
    ),
  catch: substrateSigningError,
});

/** A LunoKit extension connector seen through the shared Substrate seam. */
const lunoWallet = (connector: BaseConnector): SubstrateWallet => ({
  connect: async () => {
    // LunoKit reports a missing extension as a plain Error; check first so it
    // surfaces as the wallet being unavailable.
    if (!connector.isInstalled()) {
      throw new WalletNotAvailableError({ walletId: connector.id });
    }
    await connector.connect(connector.name);
  },
  disconnect: () => connector.disconnect(),
  // Extension accounts are not chain-specific.
  getAccounts: () =>
    connector
      .getAccounts()
      .then((accounts) => accounts.map((account) => account.address)),
  canRestore: async () => true,
  signPayload: (payload) =>
    Effect.tryPromise({
      try: () => connector.getSigner(),
      catch: substrateSigningError,
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
          try: () => signPayload(payload),
          catch: substrateSigningError,
        });
      })
    ),
});

const lunoAvailability = (connector: BaseConnector): WalletAvailability => ({
  _tag: "Injected",
  detect: Effect.sync(() => connector.isInstalled()),
  installUrl: connector.links.browserExtension,
});

const createSubstrateConnector = ({
  id,
  name,
  type,
  wallet: makeWallet,
  encodeSignedExtrinsic,
  walletDetailsParams,
  chains,
}: {
  id: string;
  name: string;
  type: string;
  /** Builds this connector's wallet; `onDisconnect` reports a wallet-side end. */
  wallet: (events: { readonly onDisconnect: () => void }) => SubstrateWallet;
  encodeSignedExtrinsic: Effect.Effect<
    EncodeSignedExtrinsic,
    WalletIntegrationError
  >;
  walletDetailsParams: WalletDetailsParams;
  chains: ReadonlyArray<Chain>;
}) =>
  createConnector<unknown, ExtraProps, StorageItem>((config) => {
    const filteredChains = chains as Chain[];
    const getFirstFilteredChain = () =>
      EArray.head(filteredChains).pipe(
        Option.getOrThrowWith(() => new Error("No supported chains found"))
      );
    // The chain whose approved accounts this connection exposes.
    const state: { chainId: number | undefined } = { chainId: undefined };
    const wallet = makeWallet({
      onDisconnect: () => {
        state.chainId = undefined;
        config.emitter.emit("disconnect");
      },
    });
    const currentChainId = () => state.chainId ?? getFirstFilteredChain().id;

    return {
      ...walletDetailsParams,
      id,
      name,
      type,
      signTransaction: (payload: {
        tx: SignerPayloadJSON;
        metadataRpc: string;
      }) =>
        wallet
          .signPayload({
            ...payload.tx,
            withSignedTransaction: true,
          })
          .pipe(
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
                    catch: substrateSigningError,
                  })
                )
              );
            })
          ),
      connect: async (args) => {
        config.emitter.emit("message", { type: "connecting" });

        await wallet.connect({
          isReconnecting: args?.isReconnecting ?? false,
        });

        // The requested chain if the wallet approved accounts on it, else the
        // first configured chain it did.
        const candidates = [
          ...filteredChains.filter((chain) => chain.id === args?.chainId),
          ...filteredChains,
        ];
        for (const chain of candidates) {
          const accounts = await wallet.getAccounts(chain.id);
          if (accounts.length === 0) continue;

          state.chainId = chain.id;
          config.storage?.removeItem("substrate.disconnected");
          config.storage?.setItem("substrate.lastConnectedId", id);

          return wagmiConnectResult(
            args?.withCapabilities,
            accounts as Address[],
            chain.id
          );
        }

        throw new Error("No accounts found");
      },
      disconnect: () => {
        state.chainId = undefined;
        config.storage?.setItem("substrate.disconnected", true);
        config.storage?.removeItem("substrate.lastConnectedId");
        return wallet.disconnect();
      },
      getAccounts: () =>
        wallet
          .getAccounts(currentChainId())
          .then((accounts) => accounts as Address[]),
      switchChain: async (chain) => {
        const chainToSwitchTo = filteredChains.find(
          (c) => c.id === chain.chainId
        );

        if (!chainToSwitchTo) throw new Error("Chain not found");

        const accounts = await wallet.getAccounts(chainToSwitchTo.id);

        if (accounts.length === 0) {
          throw new Error("Wallet approved no account on this chain");
        }

        state.chainId = chainToSwitchTo.id;
        config.emitter.emit("change", {
          accounts: accounts as Address[],
          chainId: chainToSwitchTo.id,
        });

        return chainToSwitchTo;
      },
      getChainId: async () => currentChainId(),
      isAuthorized: async () => {
        const isDisconnected = await config.storage?.getItem(
          "substrate.disconnected"
        );

        if (isDisconnected) return false;

        const lastConnectedId = await config.storage?.getItem(
          "substrate.lastConnectedId"
        );

        return lastConnectedId === id && (await wallet.canRestore());
      },
      ...makeWagmiConnectorEvents(config.emitter),
      getProvider: async () => wallet,
      $filteredChains: Stream.succeed(filteredChains),
    };
  });

export const getSubstrateConnectors = ({
  chains,
  walletConnectProtocol,
  runWalletEffect,
}: {
  readonly chains: EArray.NonEmptyReadonlyArray<SubstrateChain>;
  readonly walletConnectProtocol: WalletConnectProtocol;
  readonly runWalletEffect: RunWalletEffect;
}): Effect.Effect<WalletList[number]> =>
  Effect.gen(function* () {
    const encodeSignedExtrinsic = yield* Effect.cached(loadExtrinsicEncoder);

    return buildSubstrateWalletGroup({
      chains,
      encodeSignedExtrinsic,
      walletConnectProtocol,
      runWalletEffect,
    });
  });

const buildSubstrateWalletGroup = ({
  chains: substrateChains,
  encodeSignedExtrinsic,
  walletConnectProtocol,
  runWalletEffect,
}: {
  chains: EArray.NonEmptyReadonlyArray<SubstrateChain>;
  encodeSignedExtrinsic: Effect.Effect<
    EncodeSignedExtrinsic,
    WalletIntegrationError
  >;
  walletConnectProtocol: WalletConnectProtocol;
  runWalletEffect: RunWalletEffect;
}): WalletList[number] => {
  const subwallet = subwalletConnector();
  const talisman = talismanConnector();
  const chains = substrateChains.map((chain) => chain.wagmiChain);

  const chainGroup = {
    iconUrl: getWalletNetworkLogo("polkadot"),
    title: "Substrate",
    id: "substrate",
  };

  // Keeps the id LunoKit's WalletConnect connector used, so stored
  // `substrate.lastConnectedId` values keep restoring.
  const walletConnectId = "walletconnect";
  const walletConnectName = "WalletConnect";

  return {
    groupName: "Substrate",
    wallets: [
      () => ({
        id: walletConnectId,
        name: walletConnectName,
        iconUrl: walletConnectIcon,
        iconBackground: "#fff",
        chainGroup,
        availability: { _tag: "Remote" },
        createConnector: (walletDetailsParams) => {
          const createConnectorFn = createSubstrateConnector({
            wallet: ({ onDisconnect }) =>
              makeSubstrateWalletConnect({
                chains: substrateChains,
                walletConnectProtocol,
                runWalletEffect,
                onDisconnect,
              }),
            encodeSignedExtrinsic,
            id: walletConnectId,
            name: walletConnectName,
            type: configMeta.type,
            walletDetailsParams,
            chains,
          });

          return (config) => ({
            ...createConnectorFn(config),
            ...walletDetailsParams,
          });
        },
      }),
      () => ({
        id: talisman.id,
        name: talisman.name,
        iconUrl: talisman.icon,
        iconBackground: "#fff",
        chainGroup,
        availability: lunoAvailability(talisman),
        createConnector: (walletDetailsParams) =>
          createSubstrateConnector({
            wallet: () => lunoWallet(talisman),
            encodeSignedExtrinsic,
            id: talisman.id,
            name: talisman.name,
            type: configMeta.type,
            walletDetailsParams,
            chains,
          }),
      }),
      () => ({
        id: subwallet.id,
        name: subwallet.name,
        iconUrl: subwallet.icon,
        iconBackground: "#fff",
        chainGroup,
        availability: lunoAvailability(subwallet),
        createConnector: (walletDetailsParams) =>
          createSubstrateConnector({
            wallet: () => lunoWallet(subwallet),
            encodeSignedExtrinsic,
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
