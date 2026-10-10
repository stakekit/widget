import { Effect, Option, Queue, Schema, type Scope } from "effect";
import * as KeyValueStore from "effect/persistence/KeyValueStore";
import {
  makeWalletConnectPresentation,
  type WalletConnectModal,
  type WalletConnectPresentation,
} from "../../src/services/wallet/internal/platform/wallet-connect-presentation";
import {
  makeWalletConnectProtocol,
  type WalletConnectNamespace,
  WalletConnectNamespaceSchema,
  type WalletConnectProtocol,
  type WalletConnectSignClient,
  walletConnectSessionHint,
  walletConnectSessionOwners,
} from "../../src/services/wallet/internal/platform/wallet-connect-protocol";
import type { WalletIntegrationError } from "../../src/services/wallet/wallet-errors";
import type { WalletModal } from "../../src/services/wallet/wallet-modal";

type ConnectInput = Parameters<WalletConnectSignClient["connect"]>[0];
type RequestInput = Parameters<WalletConnectSignClient["request"]>[0];

/**
 * For tests whose subject must never reach WalletConnect (connector
 * construction, signing through other transports). Any use is a defect.
 */
export const unusedWalletConnectProtocol: WalletConnectProtocol = {
  connect: () => Effect.die(new Error("Unexpected WalletConnect proposal")),
  sessions: () => Effect.die(new Error("Unexpected WalletConnect sessions")),
  request: () => Effect.die(new Error("Unexpected WalletConnect request")),
  disconnect: () =>
    Effect.die(new Error("Unexpected WalletConnect disconnect")),
  subscribeEnded: () => {
    throw new Error("Unexpected WalletConnect subscription");
  },
};

/** A stored session in the shape `SignClient.session.getAll()` returns. */
export const walletConnectSession = (input: {
  readonly topic: string;
  readonly namespace: string;
  readonly accounts: ReadonlyArray<string>;
  readonly methods?: ReadonlyArray<string>;
  /** Seconds since epoch. Defaults to 2100-01-01. */
  readonly expiry?: number;
}) => ({
  topic: input.topic,
  expiry: input.expiry ?? 4_102_444_800,
  namespaces: {
    [input.namespace]: {
      accounts: [...input.accounts],
      methods: [...(input.methods ?? [])],
      events: [],
    },
  },
});

const decodeTopic = Schema.decodeUnknownOption(
  Schema.Struct({ topic: Schema.String })
);
const decodeNamespaced = Schema.decodeUnknownOption(
  Schema.Struct({
    topic: Schema.String,
    namespaces: Schema.Record(Schema.String, Schema.Unknown),
  })
);
const decodeNamespace = Schema.decodeUnknownOption(
  WalletConnectNamespaceSchema
);

export type FakeSignClient = Readonly<{
  client: WalletConnectSignClient;
  state: {
    /** Raw stored sessions; may contain malformed entries. */
    sessions: ReadonlyArray<unknown>;
    readonly proposals: Array<ConnectInput>;
    readonly requests: Array<RequestInput>;
    readonly disconnects: Array<string>;
    respond: (input: RequestInput) => Promise<unknown>;
  };
  /** Live `session_delete`/`session_expire` subscriptions. */
  endedSubscribers: () => number;
  /** Approves the oldest unsettled proposal and persists its session. */
  approve: (session: unknown) => void;
  /** Rejects the oldest unsettled proposal. */
  reject: (cause: unknown) => void;
  /** Simulates a wallet-side `session_delete` for `topic`. */
  end: (topic: string) => void;
}>;

/**
 * In-memory stand-in for `@walletconnect/sign-client`. Proposal `n` emits
 * `wc:proposal-<n>@2?...` and waits for `approve`/`reject`.
 */
export const makeFakeSignClient = (
  options: {
    readonly sessions?: ReadonlyArray<unknown>;
    readonly request?: (input: RequestInput) => Promise<unknown>;
  } = {}
): FakeSignClient => {
  const ended = new Set<(topic: string) => void>();
  const pending: Array<PromiseWithResolvers<unknown>> = [];
  const state: FakeSignClient["state"] = {
    sessions: options.sessions ?? [],
    proposals: [],
    requests: [],
    disconnects: [],
    respond:
      options.request ??
      (async (input) => {
        throw new Error(`Unexpected request ${input.request.method}`);
      }),
  };
  const removeSession = (topic: string) => {
    state.sessions = state.sessions.filter((session) =>
      Option.match(decodeTopic(session), {
        onNone: () => true,
        onSome: (stored) => stored.topic !== topic,
      })
    );
  };
  const nextApproval = () => {
    const approval = pending.shift();
    if (!approval) throw new Error("No pending WalletConnect proposal");
    return approval;
  };
  return {
    client: {
      connect: async (input) => {
        state.proposals.push(input);
        const approval = Promise.withResolvers<unknown>();
        pending.push(approval);
        return {
          uri: `wc:proposal-${state.proposals.length}@2?relay-protocol=irn&symKey=00`,
          approval: () => approval.promise,
        };
      },
      sessions: () => state.sessions,
      request: (input) => {
        state.requests.push(input);
        return state.respond(input);
      },
      disconnect: async (topic) => {
        state.disconnects.push(topic);
        removeSession(topic);
      },
      subscribeEnded: (listener) => {
        ended.add(listener);
        return () => {
          ended.delete(listener);
        };
      },
    },
    state,
    endedSubscribers: () => ended.size,
    approve: (session) => {
      const approval = nextApproval();
      state.sessions = [...state.sessions, session];
      approval.resolve(session);
    },
    reject: (cause) => nextApproval().reject(cause),
    end: (topic) => {
      removeSession(topic);
      for (const listener of ended) listener(topic);
    },
  };
};

type FakeWalletConnectModal = Readonly<{
  modal: WalletConnectModal;
  /** URIs passed to `open`, in order. */
  opened: Queue.Queue<string>;
  state: { visible: string | undefined };
}>;

/** In-memory stand-in for the AppKit modal used by WalletConnectPresentation. */
const makeFakeWalletConnectModal: Effect.Effect<FakeWalletConnectModal> =
  Effect.gen(function* () {
    const opened = yield* Queue.unbounded<string>();
    const listeners = new Set<(state: unknown) => void>();
    const state: FakeWalletConnectModal["state"] = { visible: undefined };
    return {
      modal: {
        open: async ({ uri }) => {
          state.visible = uri;
          for (const listener of listeners) listener({ open: true });
          Queue.offerUnsafe(opened, uri);
        },
        close: async () => {
          state.visible = undefined;
          for (const listener of listeners) listener({ open: false });
        },
        resetWcConnection: () => {},
        subscribeState: (listener) => {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
      },
      opened,
      state,
    };
  });

export type TestWalletConnect = Readonly<{
  signClient: FakeSignClient;
  modal: FakeWalletConnectModal;
  presentation: WalletConnectPresentation;
  protocol: WalletConnectProtocol;
  /** The page storage; pass it to another call to model a reload. */
  store: KeyValueStore.KeyValueStore;
  /** How many times the protocol loaded its SignClient. */
  clientLoads: () => number;
}>;

/**
 * The real WalletConnectPresentation + WalletConnectProtocol over fake AppKit
 * and SignClient SDKs. Requires `WalletModal` (provide `WalletModal.layer`).
 *
 * `store` is the browser storage of the page. Share one store between two
 * calls to model a reload. Without one, a fresh store is used, and initial
 * fake-client sessions count as approved during an earlier page load for
 * their first namespace. `loadClient` replaces handing out `signClient.client`.
 */
export const makeTestWalletConnect = (
  signClient: FakeSignClient = makeFakeSignClient(),
  options: {
    readonly store?: KeyValueStore.KeyValueStore;
    readonly loadClient?: Effect.Effect<
      WalletConnectSignClient,
      WalletIntegrationError
    >;
  } = {}
): Effect.Effect<TestWalletConnect, never, Scope.Scope | WalletModal> =>
  Effect.gen(function* () {
    const modal = yield* makeFakeWalletConnectModal;
    const presentation = yield* makeWalletConnectPresentation(
      Effect.succeed(modal.modal),
      // Tests never follow deep links out of the page.
      () => {}
    );
    const store =
      options.store ??
      (yield* makeWalletConnectTestStore(
        // Each seeded session is owned by its first namespace key
        // (`cosmos`, `cosmos:cosmoshub-4`).
        Object.fromEntries(
          signClient.state.sessions.flatMap((session) =>
            Option.toArray(decodeNamespaced(session)).flatMap(
              ({ topic, namespaces }) =>
                Object.keys(namespaces)
                  .flatMap((key) =>
                    Option.toArray(decodeNamespace(key.split(":")[0]))
                  )
                  .slice(0, 1)
                  .map((namespace) => [topic, namespace] as const)
            )
          )
        )
      ));
    let loads = 0;
    const protocol = yield* makeWalletConnectProtocol({
      loadClient: Effect.suspend(() => {
        loads += 1;
        return options.loadClient ?? Effect.sync(() => signClient.client);
      }),
      presentation,
    }).pipe(Effect.provideService(KeyValueStore.KeyValueStore, store));
    return {
      signClient,
      modal,
      presentation,
      protocol,
      store,
      clientLoads: () => loads,
    };
  });

/**
 * In-memory page storage. `approved` models sessions approved during an
 * earlier page load: topic → namespace it was proposed for.
 */
export const makeWalletConnectTestStore = (
  approved: Readonly<Record<string, WalletConnectNamespace>> = {}
) =>
  Effect.gen(function* () {
    const store = yield* KeyValueStore.KeyValueStore.pipe(
      Effect.provide(KeyValueStore.layerMemory)
    );
    if (Object.keys(approved).length > 0) {
      yield* walletConnectSessionHint(store).set(true).pipe(Effect.orDie);
      const owners = walletConnectSessionOwners(store);
      for (const [topic, namespace] of Object.entries(approved))
        yield* owners.set(topic, namespace).pipe(Effect.orDie);
    }
    return store;
  });
