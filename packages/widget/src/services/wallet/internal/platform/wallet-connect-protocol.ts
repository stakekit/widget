import * as BrowserKeyValueStore from "@effect/platform-browser/BrowserKeyValueStore";
import type { ChainNamespace } from "@reown/appkit/networks";
import {
  Clock,
  Context,
  Effect,
  Fiber,
  FiberSet,
  Layer,
  Option,
  Schema,
  type Scope,
  Semaphore,
  Stream,
  SubscriptionRef,
} from "effect";
import * as KeyValueStore from "effect/persistence/KeyValueStore";
import { UserRejectedRequestError } from "viem";
import { config } from "../../../../shared/config/widget-defaults";
import { WalletIntegrationError } from "../../wallet-errors";
import {
  type WalletConnectPresentation,
  WalletConnectPresentationPlatform,
} from "./wallet-connect-presentation";

export const WalletConnectNamespaceSchema = Schema.Literals([
  "solana",
  "stellar",
  "tron",
  "cosmos",
  "polkadot",
]);
export type WalletConnectNamespace = typeof WalletConnectNamespaceSchema.Type;

export type WalletConnectProposal = Readonly<{
  namespace: WalletConnectNamespace;
  /** CAIP-2 chain ids. */
  chains: readonly [string, ...string[]];
  /** Empty: the namespace is proposed through optionalNamespaces only. */
  requiredMethods: ReadonlyArray<string>;
  optionalMethods?: ReadonlyArray<string>;
  events?: ReadonlyArray<string>;
  /** Wallet-specific handoff for this request; not part of the pending key. */
  deepLink?: (uri: string) => string | undefined;
}>;

/** An approved session narrowed to one namespace. */
export type WalletConnectSession = Readonly<{
  topic: string;
  namespace: WalletConnectNamespace;
  /** CAIP-10 accounts of `namespace` only. */
  accounts: ReadonlyArray<string>;
  methods: ReadonlyArray<string>;
  /** Seconds since epoch. */
  expiry: number;
  /** Wallet-declared session properties; empty when absent or malformed. */
  sessionProperties: Readonly<Record<string, string>>;
}>;

export type WalletConnectRequest<A> = Readonly<{
  topic: string;
  /** CAIP-2 chain id. */
  chainId: string;
  method: string;
  params: unknown;
  response: Schema.Decoder<A>;
}>;

export type WalletConnectProtocol = Readonly<{
  /**
   * Proposes a session, or resumes the still-pending proposal for the same
   * namespace and chains, presents its pairing URI and resolves with the
   * approved session. A session approved for the same namespace and chains
   * after its presentation was dismissed is adopted without a new proposal.
   */
  connect: (
    proposal: WalletConnectProposal
  ) => Effect.Effect<WalletConnectSession, WalletIntegrationError>;
  /**
   * Unexpired persisted sessions this widget approved for `namespace`, with
   * their `namespace` accounts only.
   */
  sessions: (
    namespace: WalletConnectNamespace
  ) => Effect.Effect<
    ReadonlyArray<WalletConnectSession>,
    WalletIntegrationError
  >;
  /**
   * Sends a JSON-RPC request on a session and decodes its response. Wallet
   * rejections fail with a `UserRejectedRequestError` cause.
   */
  request: <A>(
    input: WalletConnectRequest<A>
  ) => Effect.Effect<A, WalletIntegrationError>;
  /** Deletes only this topic's session. */
  disconnect: (topic: string) => Effect.Effect<void, WalletIntegrationError>;
  /**
   * Calls `listener` when the wallet deletes or expires `topic`. Returns the
   * unsubscribe function.
   */
  subscribeEnded: (topic: string, listener: () => void) => () => void;
}>;

type ProposalNamespace = Readonly<{
  chains: ReadonlyArray<string>;
  methods: ReadonlyArray<string>;
  events: ReadonlyArray<string>;
}>;

/** The owned subset of `@walletconnect/sign-client` the protocol drives. */
export type WalletConnectSignClient = Readonly<{
  connect: (
    input: Readonly<{
      requiredNamespaces?: Readonly<Record<string, ProposalNamespace>>;
      optionalNamespaces: Readonly<Record<string, ProposalNamespace>>;
    }>
  ) => Promise<Readonly<{ uri?: string; approval: () => Promise<unknown> }>>;
  /** Raw persisted sessions. */
  sessions: () => ReadonlyArray<unknown>;
  request: (
    input: Readonly<{
      topic: string;
      chainId: string;
      request: Readonly<{ method: string; params: unknown }>;
    }>
  ) => Promise<unknown>;
  disconnect: (topic: string) => Promise<void>;
  /** `session_delete` and `session_expire`, by topic. */
  subscribeEnded: (listener: (topic: string) => void) => () => void;
}>;

const StoredSession = Schema.Struct({
  topic: Schema.String,
  expiry: Schema.Finite,
  namespaces: Schema.Record(Schema.String, Schema.Unknown),
  sessionProperties: Schema.optional(Schema.Unknown),
});
// CAIP-10 account id: `<namespace>:<chain reference>:<address>`.
const CaipAccount = Schema.String.check(
  Schema.isPattern(/^[-a-z0-9]{3,8}:[-_a-zA-Z0-9]{1,32}:[-.%a-zA-Z0-9]{1,128}$/)
);
const SessionNamespace = Schema.Struct({
  accounts: Schema.Array(Schema.Unknown),
  methods: Schema.Array(Schema.String),
});
const decodeCaipAccount = Schema.decodeUnknownOption(CaipAccount);
const decodeStoredSession = Schema.decodeUnknownOption(StoredSession);
const decodeSessionNamespace = Schema.decodeUnknownOption(SessionNamespace);
// Invalid SDK events are discarded: they name no session to end.
const decodeTopic = Schema.decodeUnknownOption(
  Schema.Struct({ topic: Schema.String })
);
const decodeSessionProperties = Schema.decodeUnknownOption(
  Schema.Record(Schema.String, Schema.String)
);
const decodeRejection = Schema.decodeUnknownOption(
  Schema.Struct({
    code: Schema.Literals([4001, 5000]),
    message: Schema.optional(Schema.String),
  })
);

const appKitNamespaces: Record<
  WalletConnectNamespace,
  ChainNamespace | undefined
> = {
  cosmos: "cosmos",
  polkadot: "polkadot",
  solana: "solana",
  // AppKit has no Stellar network; it presents its generic wallet chooser.
  stellar: undefined,
  tron: "tron",
};

const protocolError = (operation: string, cause?: unknown) =>
  Option.match(decodeRejection(cause), {
    onNone: () =>
      new WalletIntegrationError({
        cause,
        message: "WalletConnect request failed",
        operation,
      }),
    onSome: (rejection) =>
      new WalletIntegrationError({
        cause: new UserRejectedRequestError(
          new Error(rejection.message ?? "User rejected the request")
        ),
        message: "WalletConnect request rejected",
        operation,
      }),
  });

/** Narrows a raw stored/approved session to `namespace`, if it has accounts. */
const toSession = (
  namespace: WalletConnectNamespace,
  value: unknown
): Option.Option<WalletConnectSession> =>
  decodeStoredSession(value).pipe(
    Option.flatMap((stored) => {
      const entries = Object.entries(stored.namespaces).flatMap(
        ([key, entry]) =>
          key === namespace || key.startsWith(`${namespace}:`)
            ? Option.toArray(decodeSessionNamespace(entry))
            : []
      );
      const accounts = entries
        .flatMap((entry) =>
          entry.accounts.flatMap((account) =>
            Option.toArray(decodeCaipAccount(account))
          )
        )
        .filter((account) => account.startsWith(`${namespace}:`));
      return accounts.length === 0
        ? Option.none()
        : Option.some({
            topic: stored.topic,
            namespace,
            accounts: [...new Set(accounts)],
            methods: [...new Set(entries.flatMap((entry) => entry.methods))],
            expiry: stored.expiry,
            sessionProperties: Option.getOrElse(
              decodeSessionProperties(stored.sessionProperties),
              () => ({})
            ),
          });
    })
  );

const sessionHintKey = `${config.appPrefix}@1//walletConnectSessions`;
const sessionOwnerKeyPrefix = `${config.appPrefix}@1//walletConnectSessionOwner/`;

/**
 * Persisted across page loads: whether the protocol may hold sessions. Lets
 * reconnect skip loading the SDK for pages that never approved a session.
 */
export const walletConnectSessionHint = (
  store: KeyValueStore.KeyValueStore
) => {
  const hints = KeyValueStore.toSchemaStore(store, Schema.Boolean);
  return {
    // Unreadable storage must not hide restorable sessions.
    get: hints.get(sessionHintKey).pipe(
      Effect.map(Option.getOrElse(() => false)),
      Effect.orElseSucceed(() => true)
    ),
    set: (value: boolean) => hints.set(sessionHintKey, value),
  };
};

/**
 * Persisted across page loads: the namespace each topic was approved for,
 * one key per topic so tabs approving concurrently never overwrite each
 * other. Sessions the SDK store holds without an owner are never restored.
 */
export const walletConnectSessionOwners = (
  store: KeyValueStore.KeyValueStore
) => {
  const owners = KeyValueStore.toSchemaStore(
    KeyValueStore.prefix(store, sessionOwnerKeyPrefix),
    WalletConnectNamespaceSchema
  );
  return {
    // Unreadable storage owns nothing rather than restoring foreign sessions.
    get: (topic: string) =>
      owners.get(topic).pipe(Effect.orElseSucceed(() => Option.none())),
    set: (topic: string, namespace: WalletConnectNamespace) =>
      owners.set(topic, namespace),
    remove: (topic: string) => owners.remove(topic),
  };
};

type PendingProposal = Readonly<{
  connection: Effect.Effect<WalletConnectSession, WalletIntegrationError>;
  subscribeUri: (
    publish: (uri: string) => void
  ) => Effect.Effect<void, never, Scope.Scope>;
}>;

export const makeWalletConnectProtocol = Effect.fn("makeWalletConnectProtocol")(
  function* ({
    loadClient,
    presentation,
  }: {
    readonly loadClient: Effect.Effect<
      WalletConnectSignClient,
      WalletIntegrationError
    >;
    readonly presentation: WalletConnectPresentation;
  }) {
    const owner = yield* Effect.scope;
    const clientPermit = yield* Semaphore.make(1);
    const proposalPermit = yield* Semaphore.make(1);
    const endedListeners = new Map<string, Set<() => void>>();
    const pendingProposals = new Map<string, PendingProposal>();
    // Approved after their presentation was dismissed, by proposal key. The
    // next `connect` with that key adopts them; unclaimed ones stay owned.
    const unclaimedSessions = new Map<string, WalletConnectSession>();
    let client: WalletConnectSignClient | undefined;
    let unsubscribeEnded: (() => void) | undefined;
    const store = yield* KeyValueStore.KeyValueStore;
    const sessionHint = walletConnectSessionHint(store);
    const sessionOwners = walletConnectSessionOwners(store);
    // Runs owner cleanup from SDK event callbacks for this runtime's lifetime.
    const runFork = yield* FiberSet.makeRuntime();
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        // The SignClient is shared by every runtime on the page (see
        // `sharedSignClients`); persisted sessions and its transport outlive
        // this runtime. Only our subscriptions and state end here.
        unsubscribeEnded?.();
        unsubscribeEnded = undefined;
        client = undefined;
        endedListeners.clear();
        pendingProposals.clear();
        unclaimedSessions.clear();
      })
    );
    const proposalKey = (proposal: WalletConnectProposal) =>
      [proposal.namespace, ...proposal.chains].join(" ");

    const disposed = Effect.suspend(() =>
      owner.state._tag === "Closed"
        ? Effect.fail(protocolError("wallet-connect-disposed"))
        : Effect.void
    );
    // Loads once; a failed load is retried by the next caller.
    const getClient = Effect.gen(function* () {
      yield* disposed;
      if (client) return client;
      const loaded = yield* loadClient;
      yield* disposed;
      client = loaded;
      unsubscribeEnded = loaded.subscribeEnded((topic) => {
        runFork(sessionOwners.remove(topic).pipe(Effect.ignore));
        for (const listener of [...(endedListeners.get(topic) ?? [])])
          listener();
      });
      return loaded;
    }).pipe(clientPermit.withPermits(1));

    const propose = (proposal: WalletConnectProposal) =>
      Effect.gen(function* () {
        const latestUri = yield* SubscriptionRef.make<string | undefined>(
          undefined
        );
        const namespace = {
          chains: proposal.chains,
          events: proposal.events ?? [],
        };
        const fiber: Fiber.Fiber<WalletConnectSession, WalletIntegrationError> =
          yield* Effect.gen(function* () {
            const signClient = yield* getClient;
            const { uri, approval } = yield* Effect.tryPromise({
              try: () =>
                signClient.connect({
                  ...(proposal.requiredMethods.length > 0 && {
                    requiredNamespaces: {
                      [proposal.namespace]: {
                        ...namespace,
                        methods: proposal.requiredMethods,
                      },
                    },
                  }),
                  optionalNamespaces: {
                    [proposal.namespace]: {
                      ...namespace,
                      methods: proposal.optionalMethods ?? [],
                    },
                  },
                }),
              catch: (cause) => protocolError("wallet-connect-propose", cause),
            });
            if (uri) yield* SubscriptionRef.set(latestUri, uri);
            const approved = yield* Effect.tryPromise({
              try: approval,
              catch: (cause) => protocolError("wallet-connect-approval", cause),
            });
            const session = yield* toSession(proposal.namespace, approved).pipe(
              Effect.fromOption,
              Effect.mapError(() =>
                protocolError("wallet-connect-approval", approved)
              )
            );
            yield* sessionOwners
              .set(session.topic, proposal.namespace)
              .pipe(Effect.ignore);
            yield* sessionHint.set(true).pipe(Effect.ignore);
            // Claimed by the `connect` that receives it; otherwise adopted by
            // the next one with the same key.
            unclaimedSessions.set(proposalKey(proposal), session);
            return session;
          }).pipe(Effect.forkIn(owner, { startImmediately: true }));
        return { fiber, latestUri };
      });

    const pendingProposal = Effect.fn("WalletConnectProtocol.pendingProposal")(
      function* (proposal: WalletConnectProposal) {
        const key = proposalKey(proposal);
        const existing = pendingProposals.get(key);
        if (existing) return existing;
        const { fiber, latestUri } = yield* propose(proposal);
        const pending: PendingProposal = {
          // One stable Effect per proposal lets presentation resume it too.
          connection: Fiber.join(fiber),
          subscribeUri: (publish) =>
            SubscriptionRef.changes(latestUri).pipe(
              Stream.runForEach((uri) =>
                uri === undefined
                  ? Effect.void
                  : Effect.sync(() => publish(uri))
              ),
              Effect.forkScoped({ startImmediately: true }),
              Effect.asVoid
            ),
        };
        pendingProposals.set(key, pending);
        fiber.addObserver(() => {
          if (pendingProposals.get(key) === pending)
            pendingProposals.delete(key);
        });
        return pending;
      },
      proposalPermit.withPermits(1)
    );

    const sessions = Effect.fn("WalletConnectProtocol.sessions")(function* (
      namespace: WalletConnectNamespace
    ) {
      if (!client && !(yield* sessionHint.get)) return [];
      const signClient = yield* getClient;
      const stored = yield* Effect.try({
        try: () => signClient.sessions(),
        catch: (cause) => protocolError("wallet-connect-sessions", cause),
      });
      const now = yield* Clock.currentTimeMillis;
      const owned = yield* Effect.forEach(
        stored.flatMap((value) => Option.toArray(decodeStoredSession(value))),
        (session) =>
          sessionOwners.get(session.topic).pipe(
            Effect.flatMap((owner) => {
              if (Option.isNone(owner)) return Effect.succeedNone;
              // Expired topics never come back; their owner goes with them.
              return session.expiry * 1000 > now
                ? Effect.succeedSome([session.topic, owner.value] as const)
                : sessionOwners
                    .remove(session.topic)
                    .pipe(Effect.ignore, Effect.as(Option.none()));
            })
          )
      );
      const owners = Object.fromEntries(owned.flatMap(Option.toArray));
      yield* sessionHint
        .set(Object.keys(owners).length > 0)
        .pipe(Effect.ignore);
      return stored.flatMap((value) =>
        Option.toArray(toSession(namespace, value)).filter(
          (session) => owners[session.topic] === namespace
        )
      );
    });

    const protocol: WalletConnectProtocol = {
      connect: Effect.fn("WalletConnectProtocol.connect")(function* (proposal) {
        yield* disposed;
        const key = proposalKey(proposal);
        const unclaimed = unclaimedSessions.get(key);
        if (unclaimed) {
          unclaimedSessions.delete(key);
          const live = (yield* sessions(proposal.namespace)).find(
            (session) => session.topic === unclaimed.topic
          );
          if (live) return live;
        }
        const pending = yield* pendingProposal(proposal);
        const namespace = appKitNamespaces[proposal.namespace];
        const session = yield* presentation.connect({
          ...(proposal.deepLink && { deepLink: proposal.deepLink }),
          connection: pending.connection,
          subscribeUri: pending.subscribeUri,
          ...(namespace && { namespace }),
        });
        if (unclaimedSessions.get(key)?.topic === session.topic)
          unclaimedSessions.delete(key);
        return session;
      }),
      sessions,
      request: <A>({
        topic,
        chainId,
        method,
        params,
        response,
      }: WalletConnectRequest<A>) =>
        getClient.pipe(
          Effect.flatMap((signClient) =>
            Effect.tryPromise({
              try: () =>
                signClient.request({
                  topic,
                  chainId,
                  request: { method, params },
                }),
              catch: (cause) => protocolError("wallet-connect-request", cause),
            })
          ),
          Effect.flatMap((value) =>
            Schema.decodeUnknownEffect(response)(value).pipe(
              Effect.mapError((cause) =>
                protocolError("wallet-connect-response", cause)
              )
            )
          ),
          Effect.withSpan("WalletConnectProtocol.request")
        ),
      disconnect: Effect.fn("WalletConnectProtocol.disconnect")(
        function* (topic) {
          const signClient = yield* getClient;
          yield* Effect.tryPromise({
            try: () => signClient.disconnect(topic),
            catch: (cause) => protocolError("wallet-connect-disconnect", cause),
          });
          yield* sessionOwners.remove(topic).pipe(Effect.ignore);
          yield* Effect.try(() => signClient.sessions().length > 0).pipe(
            Effect.flatMap(sessionHint.set),
            Effect.ignore
          );
        }
      ),
      subscribeEnded: (topic, listener) => {
        const listeners = endedListeners.get(topic) ?? new Set();
        listeners.add(listener);
        endedListeners.set(topic, listeners);
        return () => {
          listeners.delete(listener);
          if (listeners.size === 0 && endedListeners.get(topic) === listeners)
            endedListeners.delete(topic);
        };
      },
    };
    return protocol;
  }
);

/**
 * Memoizes one SignClient per storage prefix for the page. Every SignClient
 * keeps a relayer listener for as long as the page lives, so runtimes (one
 * per widget mount) share it instead of initializing their own. A failed
 * init is forgotten so the next load retries.
 */
export const sharedSignClients = (
  init: (storagePrefix: string) => Promise<WalletConnectSignClient>
) => {
  const clients = new Map<string, Promise<WalletConnectSignClient>>();
  return (storagePrefix: string) =>
    Effect.tryPromise({
      try: () => {
        const existing = clients.get(storagePrefix);
        if (existing) return existing;
        const loading = init(storagePrefix);
        clients.set(storagePrefix, loading);
        loading.catch(() => {
          if (clients.get(storagePrefix) === loading)
            clients.delete(storagePrefix);
        });
        return loading;
      },
      catch: (cause) => protocolError("wallet-connect-load", cause),
    });
};

const initSignClient = async (
  storagePrefix: string
): Promise<WalletConnectSignClient> => {
  // Browser transport loads only when a WalletConnect wallet is used.
  const { SignClient } = await import("@walletconnect/sign-client");
  const client = await SignClient.init({
    customStoragePrefix: storagePrefix,
    metadata: {
      description: `${config.appName} wallet connection`,
      icons: config.appIcon ? [config.appIcon] : [],
      name: config.appName,
      // Wallets verify this against the page origin hosting the widget.
      url: window.location.origin,
    },
    projectId: config.walletConnectV2.projectId,
  });
  const mutable = (namespaces: Readonly<Record<string, ProposalNamespace>>) =>
    Object.fromEntries(
      Object.entries(namespaces).map(([key, value]) => [
        key,
        {
          chains: [...value.chains],
          methods: [...value.methods],
          events: [...value.events],
        },
      ])
    );
  return {
    connect: ({ requiredNamespaces, optionalNamespaces }) =>
      client.connect({
        ...(requiredNamespaces && {
          requiredNamespaces: mutable(requiredNamespaces),
        }),
        optionalNamespaces: mutable(optionalNamespaces),
      }),
    sessions: () => client.session.getAll(),
    request: (input) => client.request(input),
    disconnect: (topic) =>
      client.disconnect({
        topic,
        reason: { code: 6000, message: "User disconnected" },
      }),
    subscribeEnded: (listener) => {
      const onEnded = (event: unknown) => {
        Option.map(decodeTopic(event), ({ topic }) => listener(topic));
      };
      client.on("session_delete", onEnded);
      client.on("session_expire", onEnded);
      return () => {
        client.off("session_delete", onEnded);
        client.off("session_expire", onEnded);
      };
    },
  };
};

const loadSignClient = sharedSignClients(initSignClient)(
  "stakekit-walletconnect"
);

export class WalletConnectProtocolPlatform extends Context.Service<
  WalletConnectProtocolPlatform,
  Readonly<{
    make: Effect.Effect<WalletConnectProtocol, never, Scope.Scope>;
  }>
>()("stakekit/widget/wallet/platform/WalletConnectProtocolPlatform") {
  static readonly layer = Layer.effect(
    WalletConnectProtocolPlatform,
    Effect.gen(function* () {
      const presentationPlatform = yield* WalletConnectPresentationPlatform;
      const presentation = yield* presentationPlatform.make;
      const protocol = yield* makeWalletConnectProtocol({
        loadClient: loadSignClient,
        presentation,
      });
      return WalletConnectProtocolPlatform.of({
        make: Effect.succeed(protocol),
      });
    })
  ).pipe(Layer.provide(BrowserKeyValueStore.layerLocalStorage));
}
