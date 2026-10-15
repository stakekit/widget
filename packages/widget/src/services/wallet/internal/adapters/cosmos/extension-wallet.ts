import type { ChainWalletBase, MainWalletBase } from "@cosmos-kit/core";
import { Effect, Option, Schema } from "effect";
import {
  WalletIntegrationError,
  WalletNotAvailableError,
} from "../../../wallet-errors";
import {
  CosmosExtensionChainRecord,
  type CosmosWallet,
  type CosmosWalletConnection,
  cosmosExtensionChainStorageKey,
} from "./cosmos-connector";
import type { CosmosChainWallet } from "./cosmos-connector-meta";

const waitForWalletDelay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

/** cosmos-kit registries carry a URL or a `{ major, minor }` pair. */
const logoUrl = (logo: MainWalletBase["walletInfo"]["logo"]) =>
  (typeof logo === "string" ? logo : (logo?.major ?? logo?.minor)) ?? "";

const extensionError = (operation: string, cause: unknown) =>
  new WalletIntegrationError({
    cause,
    message: "Cosmos extension wallet request failed",
    operation,
  });

const makeChainWallet = (cw: ChainWalletBase): CosmosChainWallet => ({
  chainId: cw.chainId,
  getAccount: Effect.tryPromise({
    try: async () => {
      const getAccount = cw.client?.getAccount;
      if (!getAccount) throw new Error("Wallet cannot read Cosmos accounts");
      return getAccount.call(cw.client, cw.chainId);
    },
    catch: (cause) => extensionError("cosmos-get-account", cause),
  }),
  signDirect: (signDoc) =>
    Effect.tryPromise({
      try: async () => {
        const signDirect = cw.client?.signDirect;
        if (!signDirect || !cw.address) {
          throw new Error("Wallet cannot sign Cosmos transactions");
        }
        return signDirect.call(cw.client, cw.chainId, cw.address, signDoc);
      },
      catch: (cause) => extensionError("cosmos-sign-direct", cause),
    }),
});

/**
 * The page globals cosmos-kit's extension clients read: Keplr's `window.keplr`,
 * Leap's `window.leap`, and MetaMask's provider for the Leap Cosmos Snap.
 */
const isProviderOn = (schema: Schema.Decoder<unknown>) => {
  const decode = Schema.decodeUnknownOption(schema);
  return (page: unknown) => Option.isSome(decode(page));
};

const injectedProviders = {
  keplr: isProviderOn(Schema.Struct({ keplr: Schema.ObjectKeyword })),
  leap: isProviderOn(Schema.Struct({ leap: Schema.ObjectKeyword })),
  metaMask: isProviderOn(
    Schema.Struct({
      ethereum: Schema.Struct({ isMetaMask: Schema.Literal(true) }),
    })
  ),
};

export type CosmosInjectedProvider = keyof typeof injectedProviders;

const isInjected = (provider: CosmosInjectedProvider) =>
  typeof window !== "undefined" && injectedProviders[provider](window);

/** A cosmos-kit extension wallet (Keplr, Leap, Leap MetaMask Snap). */
export const makeExtensionWallet = (
  wallet: MainWalletBase,
  provider: CosmosInjectedProvider
): CosmosWallet => {
  const { walletInfo } = wallet;
  const hasClient = () =>
    wallet.clientMutable.state === "Done" && !!wallet.client;
  // cosmos-kit reads the extension once when the wallet manager mounts and
  // keeps that client after the extension goes away. Check the page for the
  // provider each time, and read the extension again when it has appeared.
  const detectClient = async () => {
    if (!isInjected(provider)) return false;
    if (!hasClient()) await wallet.initClient();
    return hasClient();
  };
  const signers = new Map<ChainWalletBase, CosmosChainWallet>();
  const connection = (cw: ChainWalletBase): CosmosWalletConnection => {
    if (!cw.address) {
      throw new Error(cw.message ?? "Cosmos wallet did not return an account");
    }
    const signer = signers.get(cw) ?? makeChainWallet(cw);
    signers.set(cw, signer);
    return { address: cw.address, wallet: signer };
  };
  const requireClient = async () => {
    if (!(await detectClient())) {
      throw new WalletNotAvailableError({ walletId: walletInfo.name });
    }
  };

  return {
    id: walletInfo.name,
    name: walletInfo.prettyName,
    iconUrl: logoUrl(walletInfo.logo),
    availability: {
      _tag: "Injected",
      detect: Effect.tryPromise(detectClient).pipe(
        Effect.orElseSucceed(() => false)
      ),
      installUrl: walletInfo.downloads?.find(
        (download) => download.device === "desktop"
      )?.link,
    },
    makeSession: ({ connectorId, storage }) => {
      /**
       * The chain wallet to restore: the saved chain's when cosmos-kit
       * restored it, else any chain cosmos-kit restored. cosmos-kit restores
       * only the chains of its stored accounts.
       */
      const restorable = async () => {
        const savedChainId = Schema.decodeUnknownOption(
          CosmosExtensionChainRecord
        )(await storage?.getItem(cosmosExtensionChainStorageKey)).pipe(
          Option.filter((record) => record.connectorId === connectorId),
          Option.map((record) => record.chainId),
          Option.getOrUndefined
        );
        const restored = wallet
          .getChainWalletList(false)
          .filter((cw) => !!cw.address);
        return (
          restored.find((cw) => cw.chainId === savedChainId) ?? restored[0]
        );
      };

      return {
        ready: async () => {
          for (let retries = 0; retries <= 3; retries++) {
            const { state } = wallet.clientMutable;
            if (state === "Done" || state === "Error") return;
            await waitForWalletDelay(1000);
          }
          throw new Error("Cosmos wallet client did not initialize");
        },
        connect: async (chain) => {
          await requireClient();
          const cw = wallet.getChainWallet(chain.chain_name);
          if (!cw) throw new Error("Chain wallet not found");
          if (!cw.address) await cw.connect();
          const next = connection(cw);
          await storage?.setItem(cosmosExtensionChainStorageKey, {
            connectorId,
            chainId: cw.chainId,
          });
          return next;
        },
        restore: async () => {
          await requireClient();
          const cw = await restorable();
          if (!cw) throw new Error("No Cosmos wallet account to restore");
          return connection(cw);
        },
        isAuthorized: async () => (await restorable()) !== undefined,
        disconnect: async (chain) => {
          await storage?.removeItem(cosmosExtensionChainStorageKey);
          await wallet.getChainWallet(chain.chain_name)?.disconnect();
        },
      };
    },
  };
};
