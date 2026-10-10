import type { AppKitNetwork, ChainNamespace } from "@reown/appkit/networks";
import {
  Cause,
  Context,
  Effect,
  Fiber,
  Layer,
  Option,
  Queue,
  Schema,
  type Scope,
  Semaphore,
  Stream,
  SubscriptionRef,
} from "effect";
import { UserRejectedRequestError } from "viem";
import { getProtocolChainIdentity } from "../../../../domain/wallet/network";
import { config } from "../../../../shared/config/widget-defaults";
import { WalletIntegrationError } from "../../wallet-errors";
import { WalletModal } from "../../wallet-modal";

export type WalletConnectModal = Readonly<{
  open: (options: { uri: string; namespace?: ChainNamespace }) => Promise<void>;
  close: () => Promise<void>;
  resetWcConnection: () => void;
  /** Delivers AppKit's raw state snapshots; decoded before use. */
  subscribeState: (listener: (state: unknown) => void) => () => void;
}>;

type WalletConnectInput<A> = Readonly<{
  /** Reuse this Effect to resume the same pending SDK approval. */
  connection: Effect.Effect<A, WalletIntegrationError>;
  subscribeUri: (
    publish: (uri: string) => void
  ) => Effect.Effect<void, WalletIntegrationError, Scope.Scope>;
  /**
   * Wallet-specific deep link for a pairing URI. The presentation opens it
   * once per distinct URI of a handoff, alongside the QR dialog.
   */
  deepLink?: (uri: string) => string | undefined;
  namespace?: ChainNamespace;
}>;

export type WalletConnectPresentation = Readonly<{
  connect: <A>(
    input: WalletConnectInput<A>
  ) => Effect.Effect<A, WalletIntegrationError>;
}>;

type PendingConnection<A> = Readonly<{
  fiber: Fiber.Fiber<A, WalletIntegrationError>;
  uris: Stream.Stream<string>;
}>;

type PresentationEvent =
  | { readonly type: "uri"; readonly uri: string }
  | { readonly type: "closed" }
  | { readonly type: "opened" };

const ModalState = Schema.Struct({ open: Schema.Boolean });
const decodeModalState = Schema.decodeUnknownOption(ModalState);

const presentationError = (operation: string, cause?: unknown) =>
  new WalletIntegrationError({
    cause,
    message: "WalletConnect presentation failed",
    operation,
  });

export const makeWalletConnectPresentation = Effect.fn(
  "makeWalletConnectPresentation"
)(function* (
  loadModal: Effect.Effect<WalletConnectModal, WalletIntegrationError>,
  openDeepLink: (url: string) => void
) {
  const owner = yield* Effect.scope;
  const walletModal = yield* WalletModal;
  const connectionPermit = yield* Semaphore.make(1);
  const modalPermit = yield* Semaphore.make(1);
  const pendingConnections = new Map<
    Effect.Effect<unknown, WalletIntegrationError>,
    PendingConnection<unknown>
  >();
  let loadedModal: WalletConnectModal | undefined;
  let presentationOwner: object | undefined;
  let loadingModal:
    | Fiber.Fiber<WalletConnectModal, WalletIntegrationError>
    | undefined;
  const getModal = Effect.gen(function* () {
    if (loadedModal) return loadedModal;
    const loading =
      loadingModal ??
      (yield* loadModal.pipe(
        Effect.tap((modal) =>
          Effect.sync(() => {
            loadedModal = modal;
          })
        ),
        Effect.forkIn(owner)
      ));
    loadingModal = loading;
    loading.addObserver(() => {
      loadingModal = undefined;
    });
    loadedModal = yield* Fiber.join(loading);
    return loadedModal;
  });

  const getConnection = Effect.fn("WalletConnectPresentation.getConnection")(
    function* <A>({ connection, subscribeUri }: WalletConnectInput<A>) {
      const existing = pendingConnections.get(connection);
      // The exact Effect key carries the result type of its cached fiber.
      if (existing) return existing as PendingConnection<A>;

      const latestUri = yield* SubscriptionRef.make<string | undefined>(
        undefined
      );
      const fiber = yield* Effect.gen(function* () {
        const uris = yield* Effect.acquireRelease(
          Queue.unbounded<string>(),
          (queue) => Queue.shutdown(queue)
        );
        yield* subscribeUri((uri) => {
          Queue.offerUnsafe(uris, uri);
        });
        const source = yield* Stream.fromQueue(uris).pipe(
          Stream.runForEach((uri) => SubscriptionRef.set(latestUri, uri)),
          Effect.andThen(Effect.never),
          Effect.forkScoped({ startImmediately: true })
        );
        return yield* connection.pipe(Effect.raceFirst(Fiber.join(source)));
      }).pipe(Effect.scoped, Effect.forkIn(owner));
      const pending: PendingConnection<A> = {
        fiber,
        uris: SubscriptionRef.changes(latestUri).pipe(
          Stream.filter((uri): uri is string => uri !== undefined),
          Stream.changes
        ),
      };
      pendingConnections.set(connection, pending);
      fiber.addObserver(() => {
        pendingConnections.delete(connection);
      });
      return pending;
    },
    connectionPermit.withPermits(1)
  );

  const connect: WalletConnectPresentation["connect"] = Effect.fn(
    "WalletConnectPresentation.connect"
  )(function* <A>(input: WalletConnectInput<A>) {
    if (owner.state._tag === "Closed") {
      return yield* presentationError("wallet-connect-disposed");
    }

    const opening = yield* walletModal.connectOpen.opening;
    const requestOwner = {};
    const releasePresentation = Effect.gen(function* () {
      if (presentationOwner !== requestOwner) return;
      presentationOwner = undefined;
      yield* walletModal.presentationOpen.set(false);
    });
    const cancelled = presentationError(
      "wallet-connect-cancelled",
      new UserRejectedRequestError(new Error("WalletConnect dialog closed"))
    );
    // Ending the picker opening hides this presentation at once; the request
    // itself is interrupted and closes the QR dialog as it unwinds.
    yield* opening.onEnd(releasePresentation);
    const pending = yield* getConnection(input);
    const request = Effect.gen(function* () {
      const events = yield* Queue.unbounded<PresentationEvent>();
      yield* Effect.addFinalizer(() =>
        Queue.shutdown(events).pipe(Effect.asVoid)
      );
      const source = yield* pending.uris.pipe(
        Stream.runForEach((uri) => Queue.offer(events, { type: "uri", uri })),
        Effect.andThen(Effect.never),
        Effect.forkScoped({ startImmediately: true })
      );
      const present = Effect.gen(function* () {
        const first = yield* Queue.take(events);
        if (first.type !== "uri") return yield* Effect.never;

        const loaded = yield* getModal;
        const modal = yield* Effect.acquireRelease(
          Effect.sync(() => {
            presentationOwner = requestOwner;
            return loaded;
          }),
          (modal) =>
            releasePresentation.pipe(
              Effect.andThen(
                Effect.tryPromise({
                  try: () => modal.close(),
                  catch: (cause) =>
                    presentationError("wallet-connect-close", cause),
                }).pipe(
                  Effect.catch((error) => Effect.logError(error)),
                  Effect.ensuring(Effect.sync(() => modal.resetWcConnection()))
                )
              )
            )
        );
        let wasOpen = false;
        yield* Effect.acquireRelease(
          Effect.try({
            try: () =>
              modal.subscribeState((state) => {
                // Snapshots without a boolean `open` carry no visibility change.
                const open = Option.getOrUndefined(
                  decodeModalState(state)
                )?.open;
                if (open === undefined) return;
                if (open) Queue.offerUnsafe(events, { type: "opened" });
                if (wasOpen && !open)
                  Queue.offerUnsafe(events, { type: "closed" });
                wasOpen = open;
              }),
            catch: (cause) =>
              presentationError("wallet-connect-subscribe", cause),
          }),
          (unsubscribe) => Effect.sync(unsubscribe)
        );

        let event: PresentationEvent = first;
        while (true) {
          if (event.type === "closed") return yield* cancelled;
          if (event.type === "opened") {
            yield* walletModal.presentationOpen.set(true);
          } else {
            const uri = event.uri;
            const deepLink = input.deepLink?.(uri);
            if (deepLink) {
              yield* Effect.try({
                try: () => openDeepLink(deepLink),
                catch: (cause) =>
                  presentationError("wallet-connect-deep-link", cause),
              }).pipe(Effect.catch((error) => Effect.logError(error)));
            }
            // Finish the SDK's non-abortable open before another request owns it.
            yield* Effect.tryPromise({
              try: () => modal.open({ uri, namespace: input.namespace }),
              catch: (cause) => presentationError("wallet-connect-open", cause),
            }).pipe(Effect.uninterruptible);
          }
          event = yield* Queue.take(events);
        }
      });

      // Cancelling this handoff leaves its protocol approval available for retry.
      return yield* Fiber.join(pending.fiber).pipe(
        Effect.raceFirst(present),
        Effect.raceFirst(Fiber.join(source))
      );
    }).pipe(Effect.scoped, modalPermit.withPermits(1));

    const fiber = yield* opening.run(request).pipe(
      // Only the picker opening ending interrupts the request without
      // interrupting this fiber: report it as the user's cancellation.
      Effect.catchCauseIf(Cause.hasInterruptsOnly, () =>
        Effect.fail(cancelled)
      ),
      Effect.forkIn(owner)
    );
    return yield* Fiber.join(fiber).pipe(
      Effect.ensuring(Fiber.interrupt(fiber))
    );
  });

  return { connect } satisfies WalletConnectPresentation;
});

const loadModal = Effect.tryPromise({
  try: async (): Promise<WalletConnectModal> => {
    const [
      { createAppKit },
      { mainnet, solana, tronMainnet },
      { UniversalProvider },
    ] = await Promise.all([
      import("@reown/appkit/core"),
      import("@reown/appkit/networks"),
      import("@walletconnect/universal-provider"),
    ]);
    const cosmosChainId = getProtocolChainIdentity("cosmos").chainId;
    const polkadotChainId = getProtocolChainIdentity(
      "polkadot"
    ).genesisHash.slice(2, 34);
    const cosmosNetwork = {
      id: cosmosChainId,
      chainNamespace: "cosmos",
      caipNetworkId: `cosmos:${cosmosChainId}`,
      name: "Cosmos Hub",
      nativeCurrency: { name: "Cosmos", symbol: "ATOM", decimals: 6 },
      rpcUrls: { default: { http: ["https://cosmos-rpc.publicnode.com"] } },
    } satisfies AppKitNetwork;
    const polkadotNetwork = {
      id: polkadotChainId,
      chainNamespace: "polkadot",
      caipNetworkId: `polkadot:${polkadotChainId}`,
      name: "Polkadot",
      nativeCurrency: { name: "Polkadot", symbol: "DOT", decimals: 10 },
      rpcUrls: { default: { http: ["https://rpc.polkadot.io"] } },
    } satisfies AppKitNetwork;
    const metadata = {
      description: config.appName,
      icons: config.appIcon ? [config.appIcon] : [],
      name: config.appName,
      url: window.location.origin,
    };
    // AppKit only renders QR/explorer UI. Without its own storage prefix it
    // would share the SDK-default `wc@2:` store with other WalletConnect
    // integrations, and its `open()` no-ops while it sees their sessions.
    // Nothing connects through this provider.
    const universalProvider = await UniversalProvider.init({
      customStoragePrefix: "stakekit-appkit-presentation",
      metadata,
      projectId: config.walletConnectV2.projectId,
    });
    const modal = createAppKit({
      manualWCControl: true,
      metadata,
      universalProvider,
      networks: [mainnet, solana, tronMainnet, cosmosNetwork, polkadotNetwork],
      // AppKit cannot chain-filter Stellar. Featured wallets remain discoverable
      // in its generic manual chooser without pretending Stellar is an EVM chain.
      featuredWalletIds: [
        "997a355c8f682468706a76cff1b004a7115f505fb962dac54b6e9b442dd1c380",
        "76a3d548a08cf402f5c7d021f24fd2881d767084b387a5325df88bc3d4b6f21b",
        "9c78aee7d8a771255942334d06d2cbab89e2178ee49fee4ea3b6c78032fcac76",
      ],
      projectId: config.walletConnectV2.projectId,
      themeVariables: { "--w3m-z-index": 999999999 },
    });
    // AppKit's controllers and basic modal element are SDK globals without a
    // destroy API. Reuse that element; only own this runtime's requests/state.
    modal.resetWcConnection();
    let restoreViewport: (() => void) | undefined;
    return {
      open: async (options) => {
        const network = options.namespace
          ? modal.getCaipNetwork(options.namespace)
          : undefined;
        if (network) modal.setCaipNetwork(network);
        await modal.open(options);
        const element = document.querySelector<HTMLElement>("w3m-modal");
        if (element && !restoreViewport) {
          const { width, height } = element.style;
          // Host-page overflow must not enlarge AppKit's fixed mobile viewport.
          element.style.width = "100vw";
          element.style.height = "100dvh";
          restoreViewport = () => {
            element.style.width = width;
            element.style.height = height;
          };
        }
      },
      close: async () => {
        try {
          await modal.close();
        } finally {
          restoreViewport?.();
          restoreViewport = undefined;
        }
      },
      resetWcConnection: () => modal.resetWcConnection(),
      subscribeState: (listener) => modal.subscribeState(listener),
    };
  },
  catch: (cause) => presentationError("wallet-connect-load", cause),
});

export class WalletConnectPresentationPlatform extends Context.Service<
  WalletConnectPresentationPlatform,
  Readonly<{
    make: Effect.Effect<WalletConnectPresentation, never, Scope.Scope>;
  }>
>()("stakekit/widget/wallet/platform/WalletConnectPresentationPlatform") {
  static readonly layer = Layer.effect(
    WalletConnectPresentationPlatform,
    Effect.gen(function* () {
      const presentation = yield* makeWalletConnectPresentation(
        loadModal,
        (url) => window.location.assign(url)
      );
      return WalletConnectPresentationPlatform.of({
        make: Effect.succeed(presentation),
      });
    })
  );
}
