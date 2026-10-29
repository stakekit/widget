import type { SignDoc } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { Effect, Option, Schema } from "effect";
import { WalletIntegrationError } from "../../../wallet-errors";
import {
  type CaipChainId,
  caipAddresses,
  caipChainId,
  type WalletConnectProtocol,
  type WalletConnectSession,
  type WalletConnectTopic,
} from "../../platform/wallet-connect-protocol";
import type { RunWalletEffect } from "../../runtime/effect-runner";
import type { CosmosChainsAssets } from "./chains";
import {
  type CosmosConnectorStorage,
  type CosmosWallet,
  type CosmosWalletConnection,
  CosmosWalletConnectRecord,
  type CosmosWalletSession,
  cosmosWalletConnectStorageKey,
} from "./cosmos-connector";
import type { CosmosChainWallet } from "./cosmos-connector-meta";

const requiredMethods = [
  "cosmos_getAccounts",
  "cosmos_signDirect",
  "cosmos_signAmino",
];

const Accounts = Schema.Array(
  Schema.Struct({
    address: Schema.String,
    pubkey: Schema.Uint8ArrayFromBase64,
  })
);

/** `cosmos_signDirect` wire encoding of a `SignDoc`. */
const WireSignDoc = Schema.Struct({
  chainId: Schema.String,
  bodyBytes: Schema.Uint8ArrayFromBase64,
  authInfoBytes: Schema.Uint8ArrayFromBase64,
  accountNumber: Schema.BigIntFromString,
});

const SignDirectResponse = Schema.Struct({
  signed: WireSignDoc,
  signature: Schema.Struct({
    pub_key: Schema.Struct({ type: Schema.String, value: Schema.String }),
    signature: Schema.String,
  }),
});

const cosmosError = (operation: string, message: string, cause?: unknown) =>
  new WalletIntegrationError({ cause, message, operation });

/** The bare address of `session`'s account on `caipChain`. */
const sessionAddress = (
  session: WalletConnectSession,
  caipChain: CaipChainId
) => Option.fromNullishOr(caipAddresses(session.accounts, caipChain)[0]);

const hasRequiredMethods = (session: WalletConnectSession) =>
  requiredMethods.every((method) => session.methods.includes(method));

const makeChainWallet = ({
  address,
  chainId,
  caipChain,
  protocol,
  topic,
}: {
  readonly address: string;
  readonly chainId: string;
  readonly caipChain: CaipChainId;
  readonly protocol: WalletConnectProtocol;
  readonly topic: WalletConnectTopic;
}): CosmosChainWallet => ({
  chainId,
  getAccount: protocol
    .request({
      topic,
      chainId: caipChain,
      method: "cosmos_getAccounts",
      params: {},
      response: Accounts,
    })
    .pipe(
      Effect.flatMap((accounts) =>
        Effect.fromNullishOr(
          accounts.find((account) => account.address === address)
        ).pipe(
          Effect.mapError(() =>
            cosmosError(
              "cosmos-get-accounts",
              "Wallet did not return the connected Cosmos account"
            )
          )
        )
      )
    ),
  signDirect: (signDoc: SignDoc) =>
    Schema.encodeEffect(WireSignDoc)(signDoc).pipe(
      Effect.mapError((cause) =>
        cosmosError("cosmos-sign-direct", "Invalid Cosmos sign document", cause)
      ),
      Effect.flatMap((wireSignDoc) =>
        protocol.request({
          topic,
          chainId: caipChain,
          method: "cosmos_signDirect",
          params: { signerAddress: address, signDoc: wireSignDoc },
          response: SignDirectResponse,
        })
      )
    ),
});

type OwnedSession = Readonly<{
  topic: WalletConnectTopic;
  address: string;
  unsubscribe: () => void;
}>;

const makeSession = ({
  connectorId,
  onEnded,
  protocol,
  runWalletEffect,
  storage,
}: {
  readonly connectorId: string;
  readonly onEnded: () => void;
  readonly protocol: WalletConnectProtocol;
  readonly runWalletEffect: RunWalletEffect;
  readonly storage: CosmosConnectorStorage;
}): CosmosWalletSession => {
  /** Sessions this connector approved or restored, by Cosmos chain id. */
  const owned = new Map<string, OwnedSession>();
  let activeChainId: string | undefined;
  /** Bumped by every activation and disconnect; fences async persistence. */
  let activation = 0;

  const release = (chainId: string) => {
    owned.get(chainId)?.unsubscribe();
    owned.delete(chainId);
  };

  const activate = async ({
    address,
    chainId,
    caipChain,
    topic,
  }: {
    readonly address: string;
    readonly chainId: string;
    readonly caipChain: CaipChainId;
    readonly topic: WalletConnectTopic;
  }): Promise<CosmosWalletConnection> => {
    const attempt = ++activation;
    if (owned.get(chainId)?.topic !== topic) {
      release(chainId);
      owned.set(chainId, {
        topic,
        address,
        unsubscribe: protocol.subscribeEnded(topic, () => {
          release(chainId);
          if (activeChainId !== chainId) return;
          activeChainId = undefined;
          void storage?.removeItem(cosmosWalletConnectStorageKey);
          onEnded();
        }),
      });
    }
    activeChainId = chainId;
    await storage?.setItem(cosmosWalletConnectStorageKey, {
      connectorId,
      topic,
      chainId,
      address,
    });
    // The session may have ended, or been superseded, while persisting.
    if (attempt !== activation || owned.get(chainId)?.topic !== topic) {
      if (attempt === activation) {
        await storage?.removeItem(cosmosWalletConnectStorageKey);
      }
      throw cosmosError(
        "cosmos-connect",
        "Cosmos WalletConnect session ended while connecting"
      );
    }
    return {
      address,
      wallet: makeChainWallet({ address, chainId, caipChain, protocol, topic }),
    };
  };

  const liveSession = (
    topic: WalletConnectTopic,
    caipChain: CaipChainId,
    address: string
  ) =>
    protocol
      .sessions("cosmos")
      .pipe(
        Effect.map((sessions) =>
          sessions.some(
            (session) =>
              session.topic === topic &&
              caipAddresses(session.accounts, caipChain).includes(address) &&
              hasRequiredMethods(session)
          )
        )
      );

  /** The persisted connection, if its session is still live and holds its account. */
  const restorable = async () => {
    const record = Schema.decodeUnknownOption(CosmosWalletConnectRecord)(
      await storage?.getItem(cosmosWalletConnectStorageKey)
    ).pipe(
      Option.filter((record) => record.connectorId === connectorId),
      Option.getOrUndefined
    );
    if (!record) return undefined;
    const caipChain = Option.getOrUndefined(
      caipChainId("cosmos", record.chainId)
    );
    if (!caipChain) return undefined;
    const live = await runWalletEffect(
      liveSession(record.topic, caipChain, record.address)
    );
    return live ? { ...record, caipChain } : undefined;
  };

  return {
    ready: async () => {},
    connect: async (chain: CosmosChainsAssets) => {
      const chainId = chain.chain_id;
      const caipChain = Option.getOrUndefined(caipChainId("cosmos", chainId));
      if (!caipChain) {
        throw cosmosError(
          "cosmos-connect",
          "Cosmos chain id is not a valid WalletConnect chain"
        );
      }
      // A live session already holding this chain's account, e.g. approved
      // before a reload; prefer the one this connector last used for it.
      const reusable = (
        await runWalletEffect(protocol.sessions("cosmos"))
      ).flatMap((session) =>
        hasRequiredMethods(session)
          ? Option.toArray(
              Option.map(sessionAddress(session, caipChain), (address) => ({
                address,
                topic: session.topic,
              }))
            )
          : []
      );
      const existing =
        reusable.find(({ topic }) => topic === owned.get(chainId)?.topic) ??
        reusable[0];
      if (existing) return activate({ ...existing, chainId, caipChain });
      const session = await runWalletEffect(
        protocol.connect({
          namespace: "cosmos",
          chains: [caipChain],
          requiredMethods,
          events: ["chainChanged", "accountsChanged"],
        })
      );
      const address = Option.getOrUndefined(sessionAddress(session, caipChain));
      if (!address) {
        throw cosmosError(
          "cosmos-connect",
          "Wallet did not approve an account for this Cosmos chain"
        );
      }
      return activate({ address, chainId, caipChain, topic: session.topic });
    },
    restore: async () => {
      const record = await restorable();
      if (!record) {
        await storage?.removeItem(cosmosWalletConnectStorageKey);
        throw cosmosError(
          "cosmos-reconnect",
          "No live Cosmos WalletConnect session was saved"
        );
      }
      return activate(record);
    },
    isAuthorized: async () => (await restorable()) !== undefined,
    disconnect: async () => {
      const topics = [...owned.values()].map(({ topic }) => topic);
      for (const chainId of [...owned.keys()]) release(chainId);
      activeChainId = undefined;
      activation++;
      await storage?.removeItem(cosmosWalletConnectStorageKey);
      await runWalletEffect(
        Effect.forEach(new Set(topics), protocol.disconnect, {
          discard: true,
        }).pipe(
          Effect.catch((error) =>
            Effect.logWarning("Cosmos WalletConnect disconnect failed").pipe(
              Effect.annotateLogs({ cause: error })
            )
          )
        )
      );
    },
  };
};

/** The generic Cosmos WalletConnect wallet over the shared protocol. */
export const makeCosmosWalletConnectWallet = ({
  iconUrl,
  runWalletEffect,
  walletConnectProtocol,
}: {
  readonly iconUrl: string;
  readonly runWalletEffect: RunWalletEffect;
  readonly walletConnectProtocol: WalletConnectProtocol;
}): CosmosWallet => ({
  id: "wallet-connect",
  name: "WalletConnect",
  iconUrl,
  availability: { _tag: "Remote" },
  makeSession: ({ connectorId, onEnded, storage }) =>
    makeSession({
      connectorId,
      onEnded,
      protocol: walletConnectProtocol,
      runWalletEffect,
      storage,
    }),
});
