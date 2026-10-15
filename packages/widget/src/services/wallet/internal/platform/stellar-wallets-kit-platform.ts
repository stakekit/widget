import {
  Cause,
  Context,
  Effect,
  Exit,
  Fiber,
  FiberHandle,
  Layer,
  Schema,
  type Scope,
} from "effect";
import { getProtocolChainIdentity } from "../../../../domain/wallet/network";
import type { WalletAvailability } from "../../wallet-descriptors";
import {
  WalletIntegrationError,
  WalletNotAvailableError,
} from "../../wallet-errors";
import type {
  WalletConnectProtocol,
  WalletConnectSession,
} from "./wallet-connect-protocol";

const publicNetworkPassphrase =
  getProtocolChainIdentity("stellar").networkPassphrase;
const walletConnectPublicChain = "stellar:pubnet";
const walletConnectSignMethod = "stellar_signXDR";

const AddressResult = Schema.Struct({ address: Schema.String });
const NetworkResult = Schema.Struct({
  network: Schema.String,
  networkPassphrase: Schema.String,
});
const SignedTransactionResult = Schema.Struct({
  signedTxXdr: Schema.String,
  signerAddress: Schema.optionalKey(Schema.String),
});
const WalletConnectSignedTransaction = Schema.Struct({
  signedXDR: Schema.String.check(Schema.isMinLength(1)),
});

export type StellarWalletId =
  | "albedo"
  | "freighter"
  | "lobstr"
  | "stellar-wallet-connect"
  | "xbull";

export type StellarWalletModule = Readonly<{
  disconnect?: () => Promise<void>;
  getAddress: (params: {
    path?: string;
    skipRequestAccess?: boolean;
  }) => Promise<unknown>;
  getNetwork: () => Promise<unknown>;
  isAvailable: () => Promise<boolean>;
  productIcon: string;
  productId: string;
  productName: string;
  signTransaction: (
    transactionXdr: string,
    options?: Readonly<{
      address?: string;
      networkPassphrase?: string;
      path?: string;
    }>
  ) => Promise<unknown>;
}>;

export type StellarWalletClient = Readonly<{
  availability: WalletAvailability;
  /** Fails with `WalletNotAvailableError` when the wallet's extension is missing. */
  connect: Effect.Effect<
    Readonly<{ address: string }>,
    WalletIntegrationError | WalletNotAvailableError
  >;
  disconnect: Effect.Effect<void, WalletIntegrationError>;
  iconUrl: string;
  id: StellarWalletId;
  name: string;
  reconnect: (
    address: string
  ) => Effect.Effect<Readonly<{ address: string }>, WalletIntegrationError>;
  signTransaction: (input: {
    readonly address: string;
    readonly networkPassphrase: string;
    readonly transactionXdr: string;
  }) => Effect.Effect<
    Readonly<{ signedTxXdr: string; signerAddress?: string }>,
    WalletIntegrationError
  >;
  /**
   * Calls `listener` when the wallet ends the selected connection remotely.
   * Returns the unsubscribe function.
   */
  subscribeEnded: (listener: () => void) => () => void;
}>;

const integrationError = (operation: string, cause?: unknown) =>
  new WalletIntegrationError({
    cause,
    message: "Stellar wallet request failed",
    operation,
  });

const callModule = <A, I>(
  operation: string,
  call: () => Promise<I>,
  schema: Schema.Codec<A, I>
) =>
  Effect.tryPromise({
    try: call,
    catch: (cause) => integrationError(operation, cause),
  }).pipe(
    Effect.flatMap((value) =>
      Schema.decodeUnknownEffect(schema)(value).pipe(
        Effect.mapError((cause) => integrationError(operation, cause))
      )
    )
  );

const validateMainnet = (module: StellarWalletModule) =>
  callModule(
    "stellar-read-network",
    () => module.getNetwork(),
    NetworkResult
  ).pipe(
    Effect.filterOrFail(
      (network) => network.networkPassphrase === publicNetworkPassphrase,
      () =>
        new WalletIntegrationError({
          message: "Switch the Stellar wallet to Mainnet",
          operation: "stellar-read-network",
        })
    )
  );

const moduleAddress = (
  module: StellarWalletModule,
  params: { readonly skipRequestAccess?: boolean } = {}
) =>
  callModule(
    "stellar-read-address",
    () => module.getAddress(params),
    AddressResult
  ).pipe(
    Effect.filterOrFail(
      ({ address }) => address.length > 0,
      () =>
        new WalletIntegrationError({
          message: "Select an account in the Stellar wallet",
          operation: "stellar-read-address",
        })
    )
  );

const moduleDisconnect = (module: StellarWalletModule) =>
  module.disconnect
    ? Effect.tryPromise({
        try: () => module.disconnect?.() ?? Promise.resolve(),
        catch: (cause) => integrationError("stellar-disconnect", cause),
      })
    : Effect.void;

const moduleAvailability = (module: StellarWalletModule) =>
  callModule(
    "stellar-read-availability",
    () => module.isAvailable(),
    Schema.Boolean
  );

/** Freighter's extension sets `window.freighter = true` in every page it injects into. */
const hasFreighterGlobal = Schema.is(
  Schema.Struct({ freighter: Schema.Literal(true) })
);

const moduleSignTransaction = (
  module: StellarWalletModule,
  input: {
    readonly address: string;
    readonly networkPassphrase: string;
    readonly transactionXdr: string;
  }
) =>
  callModule(
    "stellar-sign-transaction",
    () =>
      module.signTransaction(input.transactionXdr, {
        address: input.address,
        networkPassphrase: input.networkPassphrase,
      }),
    SignedTransactionResult
  );

/**
 * Chrome Web Store pages of the wallets that live in a browser extension.
 * Albedo and xBull connect through a web popup and need no extension.
 */
const extensionStorePages: Partial<Record<StellarWalletId, string>> = {
  freighter:
    "https://chromewebstore.google.com/detail/freighter/bcacfldlkkdogcmkkibnjlakofdplcbk",
  lobstr:
    "https://chromewebstore.google.com/detail/lobstr/ldiagbjmlmjiieclmdkagofdjcgodjle",
};

export const makeDirectStellarWalletClient = ({
  id,
  module,
  validateMainnet: shouldValidateMainnet,
}: {
  readonly id: Exclude<StellarWalletId, "stellar-wallet-connect">;
  readonly module: StellarWalletModule;
  readonly validateMainnet: boolean;
}): StellarWalletClient => {
  const readAddress = (skipRequestAccess: boolean) =>
    moduleAddress(module, { skipRequestAccess }).pipe(
      Effect.tap(() =>
        shouldValidateMainnet ? validateMainnet(module) : Effect.void
      )
    );

  const installUrl = extensionStorePages[id];
  const availability: WalletAvailability =
    installUrl === undefined
      ? { _tag: "Remote" }
      : {
          _tag: "Injected",
          // Freighter is found from its page global without the module's
          // slower postMessage round trip when the global is set.
          detect: Effect.suspend(() =>
            id === "freighter" && hasFreighterGlobal(globalThis)
              ? Effect.succeed(true)
              : moduleAvailability(module).pipe(
                  Effect.orElseSucceed(() => false)
                )
          ),
          installUrl,
        };
  const ensureAvailable =
    availability._tag === "Injected"
      ? availability.detect.pipe(
          Effect.flatMap((present) =>
            present
              ? Effect.void
              : Effect.fail(new WalletNotAvailableError({ walletId: id }))
          )
        )
      : Effect.void;

  return {
    availability,
    connect: ensureAvailable.pipe(Effect.andThen(readAddress(false))),
    disconnect: moduleDisconnect(module),
    iconUrl: module.productIcon,
    id,
    name: module.productName,
    reconnect: () =>
      id === "freighter"
        ? readAddress(true)
        : Effect.fail(
            new WalletIntegrationError({
              message: "Reconnect this Stellar wallet manually",
              operation: "stellar-reconnect",
            })
          ),
    signTransaction: (input) => moduleSignTransaction(module, input),
    // Extension wallets expose no remote-end event.
    subscribeEnded: () => () => {},
  };
};

export const makeWalletConnectStellarWalletClient = Effect.fn(
  "makeWalletConnectStellarWalletClient"
)(function* (
  protocol: WalletConnectProtocol
): Effect.fn.Return<StellarWalletClient, never, Scope.Scope> {
  let selected: { address: string; topic: string } | undefined;
  let unsubscribeEnded: (() => void) | undefined;
  const endedListeners = new Set<() => void>();
  const cancelled = () => integrationError("stellar-wallet-connect-cancelled");
  const select = (next: typeof selected) => {
    unsubscribeEnded?.();
    unsubscribeEnded = undefined;
    selected = next;
    if (!next) return;
    unsubscribeEnded = protocol.subscribeEnded(next.topic, () => {
      if (selected !== next) return;
      select(undefined);
      for (const listener of [...endedListeners]) listener();
    });
  };
  yield* Effect.addFinalizer(() =>
    Effect.sync(() => {
      select(undefined);
      endedListeners.clear();
    })
  );

  const supportsAccount = (session: WalletConnectSession, address: string) =>
    session.accounts.includes(`${walletConnectPublicChain}:${address}`) &&
    session.methods.includes(walletConnectSignMethod);
  const unavailable = (operation: string) =>
    new WalletIntegrationError({
      message: "The Stellar WalletConnect session expired",
      operation,
    });
  // Added after the selection finalizer so closing the scope interrupts the
  // in-flight operation before the selection is released.
  const operations = yield* FiberHandle.make();
  /**
   * Runs `operation` as the client's latest connect/disconnect/restore: a
   * later one interrupts it and closing the client's scope cancels it, so a
   * superseded operation never selects a session. Superseded or disposed
   * callers observe `stellar-wallet-connect-cancelled`.
   */
  const latest = <A, E>(
    operation: Effect.Effect<A, E>,
    whenDisposed: Effect.Effect<A, E | WalletIntegrationError>
  ): Effect.Effect<A, E | WalletIntegrationError> =>
    Effect.uninterruptibleMask((restore) => {
      if (operations.state._tag === "Closed") return restore(whenDisposed);
      return FiberHandle.run(operations, operation, {
        startImmediately: false,
      }).pipe(
        Effect.flatMap((fiber) =>
          restore(Fiber.await(fiber)).pipe(
            Effect.onInterrupt(() => Fiber.interrupt(fiber))
          )
        ),
        Effect.flatMap(
          (exit): Effect.Effect<A, E | WalletIntegrationError> =>
            Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)
              ? Effect.fail(cancelled())
              : exit
        )
      );
    });

  return {
    connect: latest(
      Effect.gen(function* () {
        const session = yield* protocol.connect({
          namespace: "stellar",
          chains: [walletConnectPublicChain],
          requiredMethods: [walletConnectSignMethod],
          optionalMethods: [
            "stellar_signAndSubmitXDR",
            "stellar_signAuthEntry",
            "stellar_signMessage",
          ],
        });
        const account = session.accounts.find(
          (account) =>
            account.startsWith(`${walletConnectPublicChain}:`) &&
            account.split(":").length === 3
        );
        const address = account?.slice(walletConnectPublicChain.length + 1);
        if (!address || !supportsAccount(session, address)) {
          return yield* unavailable("stellar-wallet-connect-approval");
        }
        select({ address, topic: session.topic });
        return { address };
      }),
      Effect.fail(cancelled())
    ),
    disconnect: Effect.suspend(() => {
      const session = selected;
      select(undefined);
      if (!session) return latest(Effect.void, Effect.void);
      return latest(
        Effect.gen(function* () {
          const sessions = yield* protocol.sessions("stellar");
          if (
            !sessions.some((candidate) => candidate.topic === session.topic)
          ) {
            return;
          }
          yield* protocol.disconnect(session.topic);
        }),
        Effect.void
      );
    }),
    iconUrl: "https://stellar.creit.tech/wallet-icons/walletconnect.png",
    id: "stellar-wallet-connect",
    availability: { _tag: "Remote" },
    name: "WalletConnect",
    reconnect: (address: string) =>
      latest(
        Effect.gen(function* () {
          const sessions = yield* protocol.sessions("stellar");
          const session = sessions.find((candidate) =>
            supportsAccount(candidate, address)
          );
          if (!address || !session) {
            return yield* unavailable("stellar-reconnect");
          }
          select({ address, topic: session.topic });
          return { address };
        }).pipe(Effect.withSpan("StellarWalletConnect.reconnect")),
        Effect.fail(cancelled())
      ),
    signTransaction: Effect.fn("StellarWalletConnect.signTransaction")(
      function* (input: Parameters<StellarWalletClient["signTransaction"]>[0]) {
        const session = selected;
        if (
          !session ||
          session.address !== input.address ||
          input.networkPassphrase !== publicNetworkPassphrase
        ) {
          return yield* unavailable("stellar-sign-transaction");
        }
        const sessions = yield* protocol.sessions("stellar");
        if (
          selected !== session ||
          !sessions.some(
            (candidate) =>
              candidate.topic === session.topic &&
              supportsAccount(candidate, input.address)
          )
        ) {
          return yield* unavailable("stellar-sign-transaction");
        }
        const result = yield* protocol
          .request({
            topic: session.topic,
            chainId: walletConnectPublicChain,
            method: walletConnectSignMethod,
            params: { xdr: input.transactionXdr },
            response: WalletConnectSignedTransaction,
          })
          .pipe(
            Effect.mapError((cause) =>
              integrationError("stellar-sign-transaction", cause)
            )
          );
        return { signedTxXdr: result.signedXDR };
      }
    ),
    subscribeEnded: (listener) => {
      endedListeners.add(listener);
      return () => {
        endedListeners.delete(listener);
      };
    },
  };
});

export type StellarWalletsKitPlatformService = Readonly<{
  load: (
    walletConnectProtocol: WalletConnectProtocol
  ) => Effect.Effect<
    ReadonlyArray<StellarWalletClient>,
    WalletIntegrationError,
    Scope.Scope
  >;
}>;

const initializeKit = Effect.tryPromise({
  try: async () => {
    const [
      { AlbedoModule },
      { FreighterModule },
      { LobstrModule },
      { xBullModule },
      { Networks },
      state,
    ] = await Promise.all([
      import("@creit-tech/stellar-wallets-kit/modules/albedo"),
      import("@creit-tech/stellar-wallets-kit/modules/freighter"),
      import("@creit-tech/stellar-wallets-kit/modules/lobstr"),
      import("@creit-tech/stellar-wallets-kit/modules/xbull"),
      import("@creit-tech/stellar-wallets-kit/types"),
      import("@creit-tech/stellar-wallets-kit/state"),
    ] as const);

    state.selectedNetwork.value = Networks.PUBLIC;
    const directModules = [
      {
        id: "freighter",
        module: new FreighterModule(),
        validateMainnet: true,
      },
      {
        id: "albedo",
        module: new AlbedoModule(),
        validateMainnet: false,
      },
      {
        id: "xbull",
        module: new xBullModule(),
        validateMainnet: false,
      },
      {
        id: "lobstr",
        module: new LobstrModule(),
        validateMainnet: false,
      },
    ] as const;

    return directModules;
  },
  catch: (cause) =>
    new WalletIntegrationError({
      cause,
      message: "Could not load Stellar Wallets Kit",
      operation: "stellar-wallets-kit-load",
    }),
});

const load = Effect.fn("StellarWalletsKitPlatform.load")(function* (
  walletConnectProtocol: WalletConnectProtocol
) {
  const directModules = yield* initializeKit;
  const walletConnect = yield* makeWalletConnectStellarWalletClient(
    walletConnectProtocol
  );

  return [
    ...directModules.map(({ id, module, validateMainnet }) =>
      makeDirectStellarWalletClient({ id, module, validateMainnet })
    ),
    walletConnect,
  ];
});

export class StellarWalletsKitPlatform extends Context.Service<
  StellarWalletsKitPlatform,
  StellarWalletsKitPlatformService
>()("stakekit/widget/wallet/platform/StellarWalletsKitPlatform") {
  static readonly layer = Layer.succeed(
    StellarWalletsKitPlatform,
    StellarWalletsKitPlatform.of({ load })
  );
}
