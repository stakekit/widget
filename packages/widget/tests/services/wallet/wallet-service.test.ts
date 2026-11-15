import { describe, expect, it, vi } from "@effect/vitest";
import {
  Deferred,
  Effect,
  Exit,
  Fiber,
  Layer,
  Option,
  Stream,
  SubscriptionRef,
} from "effect";
import { TestClock } from "effect/testing";
import { BaseError, UserRejectedRequestError, zeroAddress } from "viem";
import { mainnet, optimism } from "viem/chains";
import type { Config, Connector } from "wagmi";
import { getConnection, getConnectors } from "wagmi/actions";

import type { WalletAddress } from "../../../src/domain/identity/identifiers";
import type { WalletNetwork } from "../../../src/domain/wallet/network";
import { WalletScopeOwnerKey } from "../../../src/domain/wallet/wallet-scope";
import { WidgetConfigService } from "../../../src/services/config/widget-config";
import { WidgetPersistence } from "../../../src/services/persistence/widget-persistence";
import { TrackingService } from "../../../src/services/tracking/tracking-service";
import { makeDefaultConfig } from "../../../src/services/wallet/default-wagmi-config";
import { ExternalProviderError } from "../../../src/services/wallet/external-provider";
import {
  SolanaPlatform,
  type SolanaRuntime,
} from "../../../src/services/wallet/internal/platform/solana-platform";
import {
  type WagmiCoreObservation,
  WagmiPlatform,
  type WagmiPlatformService,
} from "../../../src/services/wallet/internal/platform/wagmi-platform";
import { WalletEnvironment } from "../../../src/services/wallet/internal/platform/wallet-environment";
import { WalletBootstrapError } from "../../../src/services/wallet/internal/runtime/bootstrap";
import type { WalletController } from "../../../src/services/wallet/internal/runtime/wagmi-config";
import {
  WalletStorageCleanup,
  WalletStorageCleanupError,
} from "../../../src/services/wallet/internal/runtime/wallet-storage-cleanup";
import {
  WalletBootstrapSource,
  WalletBootstrapSourceReadError,
} from "../../../src/services/wallet/wallet-bootstrap-source";
import {
  WalletConnectorSource,
  type WalletListFactory,
} from "../../../src/services/wallet/wallet-connector-source";
import {
  WalletBroadcastError,
  WalletConnectionError,
  WalletIntegrationError,
  WalletSigningError,
} from "../../../src/services/wallet/wallet-errors";
import { WalletModal } from "../../../src/services/wallet/wallet-modal";
import { WalletService } from "../../../src/services/wallet/wallet-service";
import type { WalletCoreState } from "../../../src/services/wallet/wallet-state";
import type { BorrowTransactionMeta } from "../../../src/services/wallet/wallet-transactions";
import { stubWalletModal } from "../../utils/wallet-modal";
import { makeWalletTestController } from "./wallet-test-controller";

// ---------------------------------------------------------------------------
// WalletService harness: real WalletService.layer, narrow platform stubs.
// ---------------------------------------------------------------------------

const makeConfigLayer = () =>
  WidgetConfigService.layer({
    apiKey: "api-key",
    disableInjectedProviderDiscovery: true,
    variant: "default",
  });

const emptySolanaPlatform = SolanaPlatform.of({
  makeRuntime: Effect.succeed({
    connection: {} as SolanaRuntime["connection"],
    current: Effect.succeed({ wallets: [] }),
    states: Stream.concat(Stream.succeed({ wallets: [] }), Stream.never),
  }),
});

/** A Solana platform that records each runtime it makes. */
const countingSolanaPlatform = () => {
  const made = vi.fn();
  return {
    made,
    platform: SolanaPlatform.of({
      makeRuntime: Effect.sync(made).pipe(
        Effect.andThen(emptySolanaPlatform.makeRuntime)
      ),
    }),
  };
};

const makeWalletServiceLayer = ({
  configLayer = makeConfigLayer(),
  connectorSource = WalletConnectorSource.defaultLayer,
  enabledNetworks = Effect.succeed(new Set<WalletNetwork>(["ethereum"])),
  modal = WalletModal.layer,
  solana = emptySolanaPlatform,
  storageCleanup = WalletStorageCleanup.layer,
  wagmi,
}: {
  readonly configLayer?: ReturnType<typeof makeConfigLayer>;
  readonly connectorSource?: Layer.Layer<WalletConnectorSource>;
  readonly enabledNetworks?: WalletBootstrapSource["Service"]["getEnabledWalletNetworks"];
  readonly modal?: Layer.Layer<WalletModal>;
  readonly solana?: SolanaPlatform["Service"];
  readonly storageCleanup?: Layer.Layer<WalletStorageCleanup>;
  readonly wagmi: WagmiPlatformService;
}) => {
  const walletLayer = WalletService.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        configLayer,
        connectorSource,
        Layer.succeed(
          WalletBootstrapSource,
          WalletBootstrapSource.of({
            getEnabledWalletNetworks: enabledNetworks,
            getOpportunity: () => Effect.die("unused"),
          })
        ),
        Layer.succeed(
          WalletEnvironment,
          WalletEnvironment.of({
            href: Effect.succeed("https://widget.test/?network=ethereum"),
            isMobileWallet: Effect.succeed(false),
          })
        ),
        Layer.succeed(SolanaPlatform, solana),
        Layer.succeed(WagmiPlatform, WagmiPlatform.of(wagmi)),
        TrackingService.layer.pipe(Layer.provide(configLayer)),
        modal,
        storageCleanup,
        WidgetPersistence.layer
      )
    )
  );
  return Layer.mergeAll(configLayer, walletLayer, modal);
};

/** A Wagmi platform that serves `controller` and publishes `core`. */
const servingWagmi = (
  controller: WalletController,
  core: WagmiCoreObservation
): WagmiPlatformService => ({
  buildConfig: () => Effect.succeed(controller),
  initialize: () => Effect.void,
  observeCore: () => Effect.succeed(core),
});

/** A disconnected Wagmi config's snapshot, published once. */
const observeConfig = (wagmiConfig: Config): WagmiCoreObservation => {
  const core = {
    connection: getConnection(wagmiConfig),
    connectors: getConnectors(wagmiConfig),
  };
  return {
    current: Effect.succeed(core),
    states: Stream.concat(Stream.succeed(core), Stream.never),
  };
};

/** A controller for a connected EVM wallet on Ethereum or Optimism. */
const makeEvmController = (actions: Record<string, unknown>) =>
  makeWalletTestController({
    actions,
    evmConfig: {
      evmChains: [mainnet, optimism],
      evmChainsMap: {
        ethereum: { network: "ethereum", wagmiChain: mainnet },
        optimism: { network: "optimism", wagmiChain: optimism },
      },
    },
    queryParamsInitChainId: undefined,
    wagmiConfig: makeDefaultConfig(),
  });

const ownerAddress = "0x0000000000000000000000000000000000000001";
const otherAddress = "0x0000000000000000000000000000000000000002";
const transactionHash = `0x${"1".repeat(64)}`;

const connector = {
  id: "injected",
  name: "Injected",
  type: "injected",
  uid: "injected-uid",
} as unknown as Connector;

const connection = ({
  address = ownerAddress,
  chain = mainnet,
  connector: connected = connector,
}: {
  readonly address?: `0x${string}`;
  readonly chain?: typeof mainnet | typeof optimism;
  readonly connector?: Connector;
} = {}): WalletCoreState["connection"] => ({
  address,
  addresses: [address],
  chain,
  chainId: chain.id,
  connector: connected,
  isConnected: true,
  isConnecting: false,
  isDisconnected: false,
  isReconnecting: false,
  status: "connected",
});

const expectedOwner = new WalletScopeOwnerKey({
  address: ownerAddress as WalletAddress,
  network: "ethereum",
});

const anyConnector = (uid: string) =>
  ({ uid, id: uid }) as Config["connectors"][number];

// ---------------------------------------------------------------------------
// Signing contract
// ---------------------------------------------------------------------------

const typedData = {
  domain: { chainId: 1, name: "Test" },
  message: { owner: zeroAddress },
  primaryType: "Authorization",
  types: { Authorization: [{ name: "owner", type: "address" }] },
};

const transaction = JSON.stringify({
  chainId: 1,
  data: "0x1234",
  from: ownerAddress,
  gasLimit: "21000",
  gasPrice: "7",
  nonce: 1,
  to: zeroAddress,
  type: 0,
  value: "12",
});

const makeOwnerLayer = ({
  core,
  failure,
  signMessage = () => Effect.succeed("0xmessage"),
}: {
  readonly core: SubscriptionRef.SubscriptionRef<WalletCoreState>;
  /** The wallet's own error, as its adapter reports it, for every signing action. */
  readonly failure?: Readonly<{ readonly cause: unknown }>;
  readonly signMessage?: (input: {
    readonly connector: Connector;
    readonly message: string;
  }) => Effect.Effect<string>;
}) =>
  makeWalletServiceLayer({
    enabledNetworks: Effect.succeed(
      new Set<WalletNetwork>(["ethereum", "optimism"])
    ),
    wagmi: servingWagmi(
      makeEvmController(
        failure === undefined
          ? {
              sendEvmTransaction: () =>
                Effect.succeed({
                  broadcasted: true,
                  signedTx: transactionHash,
                }),
              signMessage,
              signTypedData: () => Effect.succeed("0xtyped"),
            }
          : {
              sendEvmTransaction: () =>
                Effect.fail(
                  new WalletBroadcastError({
                    cause: failure.cause,
                    customMessage: null,
                  })
                ),
              signMessage: () =>
                Effect.fail(
                  new WalletSigningError({
                    cause: failure.cause,
                    operation: "message",
                  })
                ),
              signTypedData: () =>
                Effect.fail(
                  new WalletSigningError({
                    cause: failure.cause,
                    operation: "typed-data",
                  })
                ),
            }
      ),
      {
        current: SubscriptionRef.get(core),
        states: SubscriptionRef.changes(core),
      }
    ),
  });

/** Moves the wallet to `next` after the workflow captured its owner and waits until Wallet State shows it. */
const changeWallet = (
  core: SubscriptionRef.SubscriptionRef<WalletCoreState>,
  next: WalletCoreState["connection"]
) =>
  Effect.gen(function* () {
    const wallet = yield* WalletService;
    const changed = yield* wallet.states.pipe(
      Stream.filter(
        (state) =>
          state.connection.status === "connected" &&
          state.connection.address === next.address &&
          state.connection.chain.id === next.chainId
      ),
      Stream.runHead,
      Effect.map(Option.getOrThrow),
      Effect.forkChild({ startImmediately: true })
    );
    yield* SubscriptionRef.set(core, {
      connection: next,
      connectors: [connector],
    });
    yield* Fiber.join(changed);
  });

const signEach = Effect.gen(function* () {
  const wallet = yield* WalletService;
  return {
    message: yield* wallet
      .signMessage({ expectedOwner, message: "hello" })
      .pipe(Effect.result),
    transaction: yield* wallet
      .signTransaction({
        expectedOwner,
        family: "yield",
        ledgerHwAppId: null,
        network: "ethereum",
        tx: transaction,
        txMeta: {} as never,
      })
      .pipe(Effect.result),
    typedData: yield* wallet
      .signTypedData({
        expectedOwner,
        txMeta: {} as BorrowTransactionMeta,
        typedData,
      })
      .pipe(Effect.result),
  };
});

const mismatch = (
  operation: "message" | "transaction" | "typed-data",
  reason: "account-changed" | "network-changed"
) => ({
  _tag: "Failure",
  failure: { _tag: "WalletOwnerMismatchError", operation, reason },
});

const cancelled = (operation: "message" | "transaction" | "typed-data") => ({
  _tag: "Failure",
  failure: { _tag: "WalletRequestCancelledError", operation },
});

describe("wallet service contract", () => {
  it.effect("signs every command for the expected Wallet Scope Owner", () =>
    Effect.gen(function* () {
      const core = yield* SubscriptionRef.make<WalletCoreState>({
        connection: connection(),
        connectors: [connector],
      });

      expect(
        yield* signEach.pipe(
          Effect.scoped,
          Effect.provide(makeOwnerLayer({ core }))
        )
      ).toMatchObject({
        message: { _tag: "Success", success: "0xmessage" },
        transaction: {
          _tag: "Success",
          success: { broadcasted: true, signedTx: transactionHash },
        },
        typedData: { _tag: "Success", success: "0xtyped" },
      });
    })
  );

  it.effect(
    "rejects signing when the account changed after the workflow started",
    () =>
      Effect.gen(function* () {
        const core = yield* SubscriptionRef.make<WalletCoreState>({
          connection: connection(),
          connectors: [connector],
        });

        expect(
          yield* Effect.gen(function* () {
            yield* changeWallet(core, connection({ address: otherAddress }));
            return yield* signEach;
          }).pipe(Effect.scoped, Effect.provide(makeOwnerLayer({ core })))
        ).toMatchObject({
          message: mismatch("message", "account-changed"),
          transaction: mismatch("transaction", "account-changed"),
          typedData: mismatch("typed-data", "account-changed"),
        });
      })
  );

  it.effect(
    "rejects signing when the network changed after the workflow started",
    () =>
      Effect.gen(function* () {
        const core = yield* SubscriptionRef.make<WalletCoreState>({
          connection: connection(),
          connectors: [connector],
        });

        expect(
          yield* Effect.gen(function* () {
            yield* changeWallet(core, connection({ chain: optimism }));
            return yield* signEach;
          }).pipe(Effect.scoped, Effect.provide(makeOwnerLayer({ core })))
        ).toMatchObject({
          message: mismatch("message", "network-changed"),
          transaction: mismatch("transaction", "network-changed"),
          typedData: mismatch("typed-data", "network-changed"),
        });
      })
  );

  it.effect("keeps a started command on the owner it was checked against", () =>
    Effect.gen(function* () {
      const started = yield* Deferred.make<void>();
      const release = yield* Deferred.make<void>();
      const core = yield* SubscriptionRef.make<WalletCoreState>({
        connection: connection(),
        connectors: [connector],
      });
      const layer = makeOwnerLayer({
        core,
        signMessage: () =>
          Deferred.succeed(started, undefined).pipe(
            Effect.andThen(Deferred.await(release)),
            Effect.as("0xstarted")
          ),
      });

      expect(
        yield* Effect.gen(function* () {
          const wallet = yield* WalletService;
          const signing = yield* wallet
            .signMessage({ expectedOwner, message: "hello" })
            .pipe(Effect.forkChild({ startImmediately: true }));
          yield* Deferred.await(started);
          yield* changeWallet(core, connection({ address: otherAddress }));
          yield* Deferred.succeed(release, undefined);
          return yield* Fiber.join(signing);
        }).pipe(Effect.scoped, Effect.provide(layer))
      ).toBe("0xstarted");
    })
  );

  it.effect("keeps an in-flight command on its captured routing context", () =>
    Effect.gen(function* () {
      const firstStarted = yield* Deferred.make<void>();
      const firstRelease = yield* Deferred.make<void>();
      const enrichmentStarted = yield* Deferred.make<void>();
      const enrichmentRelease =
        yield* Deferred.make<ReadonlyArray<typeof mainnet>>();
      const firstConnector = {
        id: "first",
        name: "First",
        type: "injected",
        uid: "first-uid",
      } as unknown as Connector;
      const secondConnector = {
        $filteredChains: Stream.fromEffect(
          Effect.gen(function* () {
            yield* Deferred.succeed(enrichmentStarted, undefined);
            return yield* Deferred.await(enrichmentRelease);
          })
        ),
        id: "second",
        name: "Second",
        type: "injected",
        uid: "second-uid",
      } as unknown as Connector;
      const routed: string[] = [];
      const core = yield* SubscriptionRef.make<WalletCoreState>({
        connection: connection({ connector: firstConnector }),
        connectors: [firstConnector, secondConnector],
      });
      const layer = makeOwnerLayer({
        core,
        signMessage: ({ connector: signer, message }) =>
          Effect.gen(function* () {
            routed.push(signer.uid);
            if (message === "first") {
              yield* Deferred.succeed(firstStarted, undefined);
              yield* Deferred.await(firstRelease);
            }
            return signer.uid;
          }),
      });

      const result = yield* Effect.scoped(
        Effect.gen(function* () {
          const wallet = yield* WalletService;
          const first = yield* wallet
            .signMessage({ expectedOwner, message: "first" })
            .pipe(Effect.forkChild({ startImmediately: true }));
          yield* Deferred.await(firstStarted);
          const changed = yield* wallet.states.pipe(
            Stream.filter(
              (state) =>
                state.connection.status === "connected" &&
                state.connection.connector.uid === secondConnector.uid
            ),
            Stream.runHead,
            Effect.map(Option.getOrThrow),
            Effect.forkChild({ startImmediately: true })
          );
          yield* SubscriptionRef.set(core, {
            connection: connection({ connector: secondConnector }),
            connectors: [firstConnector, secondConnector],
          });
          yield* Deferred.await(enrichmentStarted);
          const duringTransition = yield* wallet
            .signMessage({ expectedOwner, message: "during-transition" })
            .pipe(Effect.result);
          yield* Deferred.succeed(enrichmentRelease, [mainnet]);
          yield* Fiber.join(changed);
          const second = yield* wallet.signMessage({
            expectedOwner,
            message: "second",
          });
          yield* Deferred.succeed(firstRelease, undefined);
          return {
            duringTransition,
            first: yield* Fiber.join(first),
            second,
          };
        }).pipe(Effect.provide(layer))
      );

      expect(result).toMatchObject({
        duringTransition: {
          _tag: "Failure",
          failure: {
            _tag: "WalletOwnerMismatchError",
            operation: "message",
            reason: "disconnected",
          },
        },
        first: "first-uid",
        second: "second-uid",
      });
      expect(routed).toEqual(["first-uid", "second-uid"]);
    })
  );

  it.effect.each([
    [
      "an EVM wallet",
      // Wagmi wraps the wallet's EIP-1193 rejection in its own error.
      new BaseError("Transaction failed.", {
        cause: new UserRejectedRequestError(
          new Error("User denied transaction signature.")
        ),
      }),
    ],
    [
      "TonConnect",
      new WalletIntegrationError({
        cause: new Error(
          "[TON_CONNECT_SDK_ERROR] UserRejectsError: User rejects the action in the wallet."
        ),
        message: "User rejects the action in the wallet.",
        operation: "ton-send-transaction",
      }),
    ],
  ])("reports a request the user rejected in %s as cancelled", ([, cause]) =>
    Effect.gen(function* () {
      const core = yield* SubscriptionRef.make<WalletCoreState>({
        connection: connection(),
        connectors: [connector],
      });

      expect(
        yield* signEach.pipe(
          Effect.scoped,
          Effect.provide(makeOwnerLayer({ core, failure: { cause } }))
        )
      ).toMatchObject({
        message: cancelled("message"),
        transaction: cancelled("transaction"),
        typedData: cancelled("typed-data"),
      });
    })
  );

  it.effect.each([
    [
      "a wallet failure",
      new BaseError("Transaction failed.", {
        cause: new Error("insufficient funds for gas * price + value"),
      }),
    ],
    ["a wallet failure without detail", undefined],
    [
      "a host provider's own error",
      new ExternalProviderError({
        customMessage: "Request rejected by host policy",
        message: "Request rejected by host policy",
      }),
    ],
  ])("keeps %s a failure", ([, cause]) =>
    Effect.gen(function* () {
      const core = yield* SubscriptionRef.make<WalletCoreState>({
        connection: connection(),
        connectors: [connector],
      });

      expect(
        yield* signEach.pipe(
          Effect.scoped,
          Effect.provide(makeOwnerLayer({ core, failure: { cause } }))
        )
      ).toMatchObject({
        message: { failure: { _tag: "WalletSigningError" } },
        transaction: { failure: { _tag: "WalletBroadcastError" } },
        typedData: { failure: { _tag: "WalletSigningError" } },
      });
    })
  );
});

// ---------------------------------------------------------------------------
// Acquisition and connection attempts
// ---------------------------------------------------------------------------

/** A WalletService whose wallet connects through `connect`. */
const makeConnectingLayer = (connect: (input: never) => unknown) => {
  const wagmiConfig = makeDefaultConfig();
  return makeWalletServiceLayer({
    wagmi: servingWagmi(
      makeWalletTestController({ actions: { connect }, wagmiConfig }),
      observeConfig(wagmiConfig)
    ),
  });
};

describe("WalletService acquisition", () => {
  it.effect(
    "interrupts a connection when its picker closes, leaving the reopened picker open",
    () =>
      Effect.gen(function* () {
        const started = yield* Deferred.make<void>();
        const release = yield* Deferred.make<void>();
        const continued = { value: false };
        const layer = makeConnectingLayer(() =>
          Deferred.succeed(started, undefined).pipe(
            Effect.andThen(Deferred.await(release)),
            Effect.andThen(
              Effect.sync(() => {
                continued.value = true;
              })
            ),
            Effect.as({ accounts: [], chainId: 1 })
          )
        );
        yield* Effect.gen(function* () {
          const wallet = yield* WalletService;
          const modal = yield* WalletModal;
          yield* modal.openConnect;
          const pending = yield* Effect.forkChild(
            wallet.connect({ connector: anyConnector("wallet") })
          );
          yield* Deferred.await(started);
          expect(yield* modal.connectOpen.current).toBe(true);
          expect(yield* wallet.connectionAttempt).toEqual({ _tag: "Pending" });
          yield* modal.connectOpen.set(false);
          expect(yield* wallet.connectionAttempt).toEqual({ _tag: "Idle" });
          yield* modal.openConnect;
          yield* Deferred.succeed(release, undefined);
          expect(Exit.hasInterrupts(yield* Fiber.await(pending))).toBe(true);
          expect(continued.value).toBe(false);
          expect(yield* modal.connectOpen.current).toBe(true);
          expect(yield* wallet.connectionAttempt).toEqual({ _tag: "Idle" });
        }).pipe(Effect.provide(layer));
      })
  );

  it.effect(
    "keeps a reopened picker's attempt when the abandoned wallet approves",
    () =>
      Effect.gen(function* () {
        const firstStarted = yield* Deferred.make<void>();
        const firstApproval = yield* Deferred.make<void>();
        const secondStarted = yield* Deferred.make<void>();
        const secondApproval = yield* Deferred.make<void>();
        const layer = makeConnectingLayer(
          (input: { connector: { uid: string } }) =>
            input.connector.uid === "first"
              ? Deferred.succeed(firstStarted, undefined).pipe(
                  Effect.andThen(Deferred.await(firstApproval)),
                  Effect.as({ accounts: [], chainId: 1 })
                )
              : Deferred.succeed(secondStarted, undefined).pipe(
                  Effect.andThen(Deferred.await(secondApproval)),
                  Effect.as({ accounts: [], chainId: 1 })
                )
        );
        yield* Effect.gen(function* () {
          const wallet = yield* WalletService;
          const modal = yield* WalletModal;
          yield* modal.openConnect;
          const first = yield* Effect.forkChild(
            wallet.connect({ connector: anyConnector("first") })
          );
          yield* Deferred.await(firstStarted);
          yield* modal.openConnect;
          const second = yield* Effect.forkChild(
            wallet.connect({ connector: anyConnector("second") })
          );
          yield* Deferred.await(secondStarted);

          yield* Deferred.succeed(firstApproval, undefined);
          expect(Exit.hasInterrupts(yield* Fiber.await(first))).toBe(true);
          expect(yield* wallet.connectionAttempt).toEqual({ _tag: "Pending" });
          expect(yield* modal.connectOpen.current).toBe(true);

          yield* Deferred.succeed(secondApproval, undefined);
          yield* Fiber.join(second);
          expect(yield* wallet.connectionAttempt).toEqual({ _tag: "Idle" });
          expect(yield* modal.connectOpen.current).toBe(false);
        }).pipe(Effect.provide(layer));
      })
  );

  it.effect("allows only one wallet connection prompt at a time", () =>
    Effect.gen(function* () {
      const started = yield* Deferred.make<void>();
      const release = yield* Deferred.make<void>();
      const connect = vi.fn(() =>
        Deferred.succeed(started, undefined).pipe(
          Effect.andThen(Deferred.await(release)),
          Effect.as({ accounts: [], chainId: 1 })
        )
      );
      const layer = makeConnectingLayer(connect);

      yield* Effect.gen(function* () {
        const wallet = yield* WalletService;
        const first = yield* Effect.forkChild(
          wallet.connect({ connector: anyConnector("first") })
        );
        yield* Deferred.await(started);
        yield* wallet.connect({ connector: anyConnector("second") });
        expect(connect).toHaveBeenCalledTimes(1);
        expect(yield* wallet.connectionAttempt).toEqual({ _tag: "Pending" });

        yield* Deferred.succeed(release, undefined);
        yield* Fiber.join(first);
        expect(yield* wallet.connectionAttempt).toEqual({ _tag: "Idle" });
      }).pipe(Effect.provide(layer));
    })
  );

  it.effect(
    "treats native wallet dismissal as cancellation and permits retry",
    () =>
      Effect.gen(function* () {
        const connect = vi.fn(() =>
          Effect.fail(
            new WalletConnectionError({
              operation: "connect",
              cause: { code: 4001, message: "Request rejected" },
            })
          )
        );
        const layer = makeConnectingLayer(connect);

        yield* Effect.gen(function* () {
          const wallet = yield* WalletService;
          const modal = yield* WalletModal;
          yield* modal.openConnect;
          const walletConnect = anyConnector("wallet-connect");
          yield* wallet.connect({ connector: walletConnect });
          expect(yield* wallet.connectionAttempt).toEqual({ _tag: "Idle" });
          expect(yield* modal.connectOpen.current).toBe(true);
          yield* wallet.connect({ connector: walletConnect });
          expect(connect).toHaveBeenCalledTimes(2);
        }).pipe(Effect.provide(layer));
      })
  );

  it.effect(
    "starts a reopened connect dialog without the previous failure",
    () =>
      Effect.gen(function* () {
        const layer = makeConnectingLayer(() =>
          Effect.fail(
            new WalletConnectionError({
              operation: "connect",
              cause: new Error("RPC unavailable"),
            })
          )
        );
        yield* Effect.gen(function* () {
          const wallet = yield* WalletService;
          const modal = yield* WalletModal;
          yield* modal.openConnect;
          yield* wallet.connect({ connector: anyConnector("wallet") });
          expect((yield* wallet.connectionAttempt)._tag).toBe("Failed");
          yield* modal.connectOpen.set(false);
          yield* modal.openConnect;
          expect((yield* wallet.connectionAttempt)._tag).toBe("Idle");
        }).pipe(Effect.provide(layer));
      })
  );

  it.effect(
    "permits a new ecosystem attempt before the abandoned provider settles",
    () =>
      Effect.gen(function* () {
        const started = yield* Deferred.make<void>();
        const interrupted = yield* Deferred.make<void>();
        const connect = vi.fn((input: { connector: { uid: string } }) =>
          input.connector.uid === "first"
            ? Deferred.succeed(started, undefined).pipe(
                Effect.andThen(Effect.never),
                Effect.onInterrupt(() =>
                  Deferred.succeed(interrupted, undefined).pipe(Effect.asVoid)
                ),
                Effect.as({ accounts: [], chainId: 1 })
              )
            : Effect.fail(
                new WalletConnectionError({
                  operation: "connect",
                  cause: new Error("Second ecosystem unavailable"),
                })
              )
        );
        const layer = makeConnectingLayer(connect);
        yield* Effect.gen(function* () {
          const wallet = yield* WalletService;
          const modal = yield* WalletModal;
          yield* modal.openConnect;
          const first = yield* wallet
            .connect({ connector: anyConnector("first") })
            .pipe(Effect.forkChild({ startImmediately: true }));
          yield* Deferred.await(started);
          // Back and ecosystem selection keep the logical picker open but start
          // a new opening, so they interrupt just like an explicit close.
          yield* modal.connectOpen.set(true);
          expect(yield* wallet.connectionAttempt).toEqual({ _tag: "Idle" });
          yield* wallet.connect({ connector: anyConnector("second") });
          yield* Deferred.await(interrupted);
          expect(Exit.hasInterrupts(yield* Fiber.await(first))).toBe(true);
          expect(connect).toHaveBeenCalledTimes(2);
          expect(yield* wallet.connectionAttempt).toEqual({ _tag: "Failed" });
          expect(yield* modal.connectOpen.current).toBe(true);
        }).pipe(Effect.provide(layer));
      })
  );

  it.effect("blocks until bootstrap and initial connection finish", () =>
    Effect.gen(function* () {
      const buildStarted = yield* Deferred.make<void>();
      const buildRelease = yield* Deferred.make<void>();
      const initializeStarted = yield* Deferred.make<void>();
      const initializeRelease = yield* Deferred.make<void>();
      const acquired = yield* Deferred.make<WalletService["Service"]>();
      const releaseScope = yield* Deferred.make<void>();
      const wagmiConfig = makeDefaultConfig();
      const controller = makeWalletTestController({
        actions: {},
        queryParamsInitChainId: undefined,
        wagmiConfig,
      });
      const layer = makeWalletServiceLayer({
        wagmi: {
          buildConfig: () =>
            Effect.gen(function* () {
              yield* Deferred.succeed(buildStarted, undefined);
              yield* Deferred.await(buildRelease);
              return controller;
            }),
          initialize: () =>
            Effect.gen(function* () {
              yield* Deferred.succeed(initializeStarted, undefined);
              yield* Deferred.await(initializeRelease);
            }),
          observeCore: () => Effect.succeed(observeConfig(wagmiConfig)),
        },
      });

      const fiber = yield* Effect.forkChild(
        Effect.scoped(
          Effect.gen(function* () {
            const wallet = yield* WalletService;
            yield* Deferred.succeed(acquired, wallet);
            yield* Deferred.await(releaseScope);
          }).pipe(Effect.provide(layer))
        )
      );

      yield* Deferred.await(buildStarted);
      expect(Option.isNone(yield* Deferred.poll(acquired))).toBe(true);
      yield* Deferred.succeed(buildRelease, undefined);
      yield* Deferred.await(initializeStarted);
      expect(Option.isNone(yield* Deferred.poll(acquired))).toBe(true);
      yield* Deferred.succeed(initializeRelease, undefined);

      const wallet = yield* Deferred.await(acquired);
      const state = yield* wallet.state;
      expect(wallet.wagmiConfig).toBe(wagmiConfig);
      expect(state.connection.status).toBe("disconnected");
      expect(state.ledger).toEqual({
        accounts: [],
        currentAccountId: undefined,
        disabledChains: [],
      });

      yield* Deferred.succeed(releaseScope, undefined);
      yield* Fiber.join(fiber);
    })
  );

  it.effect(
    "builds and initializes the wallet config once from bootstrap inputs",
    () =>
      Effect.gen(function* () {
        const wagmiConfig = makeDefaultConfig();
        const controller = makeWalletTestController({
          actions: {},
          queryParamsInitChainId: undefined,
          wagmiConfig,
        });
        const builds: unknown[] = [];
        const initializations: unknown[] = [];
        const layer = makeWalletServiceLayer({
          wagmi: {
            buildConfig: (input) =>
              Effect.sync(() => {
                builds.push(input);
                return controller;
              }),
            initialize: (input) =>
              Effect.sync(() => {
                initializations.push(input);
              }),
            observeCore: () => Effect.succeed(observeConfig(wagmiConfig)),
          },
        });

        yield* Effect.scoped(WalletService.pipe(Effect.provide(layer)));

        expect(builds).toHaveLength(1);
        expect(builds[0]).toMatchObject({
          disableInjectedProviderDiscovery: true,
          enabledNetworks: new Set(["ethereum"]),
          queryParams: { network: "ethereum" },
        });
        expect(initializations).toEqual([
          expect.objectContaining({ wagmiConfig }),
        ]);
      })
  );

  it.effect("captures an injected Wallet List as fixed wallet topology", () =>
    Effect.gen(function* () {
      const walletListFactory: WalletListFactory = vi.fn(() => []);
      const buildInputs: Array<
        Parameters<WagmiPlatformService["buildConfig"]>[0]
      > = [];
      const solana = countingSolanaPlatform();
      const wagmiConfig = makeDefaultConfig();
      const controller = makeWalletTestController({
        actions: {},
        queryParamsInitChainId: undefined,
        wagmiConfig,
      });
      const layer = makeWalletServiceLayer({
        connectorSource: WalletConnectorSource.layer(walletListFactory),
        enabledNetworks: Effect.succeed(
          new Set<WalletNetwork>(["ethereum", "solana"])
        ),
        solana: solana.platform,
        wagmi: {
          buildConfig: (input) =>
            Effect.sync(() => {
              buildInputs.push(input);
              return controller;
            }),
          initialize: () => Effect.void,
          observeCore: () => Effect.succeed(observeConfig(wagmiConfig)),
        },
      });

      yield* Effect.scoped(WalletService.pipe(Effect.provide(layer)));

      expect(solana.made).not.toHaveBeenCalled();
      expect(buildInputs).toEqual([
        expect.objectContaining({ walletListFactory }),
      ]);
    })
  );

  it.effect.each([
    { name: "Solana disabled", networks: ["ethereum"], runtimes: 0 },
    {
      name: "Solana enabled",
      networks: ["ethereum", "solana"],
      runtimes: 1,
    },
  ] as const)(
    "makes a Solana runtime only for ecosystem Solana wallets ($name)",
    ({ networks, runtimes }) =>
      Effect.gen(function* () {
        const solana = countingSolanaPlatform();
        const wagmiConfig = makeDefaultConfig();
        const layer = makeWalletServiceLayer({
          enabledNetworks: Effect.succeed(new Set<WalletNetwork>(networks)),
          solana: solana.platform,
          wagmi: {
            buildConfig: () =>
              Effect.succeed(
                makeWalletTestController({
                  actions: {},
                  queryParamsInitChainId: undefined,
                  wagmiConfig,
                })
              ),
            initialize: () => Effect.void,
            observeCore: () => Effect.succeed(observeConfig(wagmiConfig)),
          },
        });

        yield* Effect.scoped(WalletService.pipe(Effect.provide(layer)));

        expect(solana.made).toHaveBeenCalledTimes(runtimes);
      })
  );

  it.effect(
    "fails acquisition with the bootstrap stage and never exposes a service",
    () =>
      Effect.gen(function* () {
        const cause = new Error("configuration failed");
        const layer = makeWalletServiceLayer({
          wagmi: {
            buildConfig: () => Effect.fail({ cause } as never),
            initialize: () => Effect.void,
            observeCore: () => Effect.die("must not observe"),
          },
        });

        const failure = yield* Effect.scoped(
          WalletService.pipe(Effect.provide(layer), Effect.flip)
        );

        expect(failure).toBeInstanceOf(WalletBootstrapError);
        expect(failure).toMatchObject({ stage: "wagmi-config" });
        expect((failure as WalletBootstrapError).cause).toEqual({ cause });
      })
  );

  it.effect("fails acquisition after bounded enabled-network retries", () =>
    Effect.gen(function* () {
      const cause = new Error("enabled networks unavailable");
      const layer = makeWalletServiceLayer({
        enabledNetworks: Effect.fail(
          new WalletBootstrapSourceReadError({ cause })
        ),
        wagmi: {
          buildConfig: () => Effect.die("must not build"),
          initialize: () => Effect.void,
          observeCore: () => Effect.die("must not observe"),
        },
      });

      const failure = yield* Effect.gen(function* () {
        const fiber = yield* Effect.scoped(
          WalletService.pipe(Effect.provide(layer), Effect.flip)
        ).pipe(Effect.forkChild({ startImmediately: true }));
        yield* Effect.yieldNow;
        yield* TestClock.adjust("4 seconds");
        return yield* Fiber.join(fiber);
      }).pipe(Effect.provide(TestClock.layer()));

      expect(failure).toMatchObject({
        _tag: "WalletBootstrapError",
        stage: "enabled-networks",
      });
      expect((failure as WalletBootstrapError).cause).toEqual(
        new WalletBootstrapSourceReadError({ cause })
      );
    })
  );
});

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

const makeLogoutLayer = ({
  cleanup,
  close,
  disconnect,
}: {
  readonly cleanup: Effect.Effect<void, WalletStorageCleanupError>;
  readonly close: Effect.Effect<void>;
  readonly disconnect: Effect.Effect<void, WalletConnectionError>;
}) =>
  makeWalletServiceLayer({
    modal: Layer.succeed(WalletModal, stubWalletModal({ closeChain: close })),
    storageCleanup: Layer.succeed(WalletStorageCleanup, {
      clearOwnedStorage: cleanup,
    }),
    wagmi: servingWagmi(makeEvmController({ disconnect: () => disconnect }), {
      current: Effect.succeed({
        connection: connection(),
        connectors: [connector],
      }),
      states: Stream.never,
    }),
  });

const runLogout = (layer: ReturnType<typeof makeLogoutLayer>) =>
  Effect.scoped(
    WalletService.use((wallet) => wallet.logout).pipe(Effect.provide(layer))
  );

describe("WalletService logout", () => {
  it.effect("disconnects, awaits owned cleanup, then closes the modal", () =>
    Effect.gen(function* () {
      const events: string[] = [];
      yield* runLogout(
        makeLogoutLayer({
          cleanup: Effect.sync(() => events.push("cleanup")).pipe(
            Effect.asVoid
          ),
          close: Effect.sync(() => events.push("close")).pipe(Effect.asVoid),
          disconnect: Effect.sync(() => events.push("disconnect")).pipe(
            Effect.asVoid
          ),
        })
      );

      expect(events).toEqual(["disconnect", "cleanup", "close"]);
    })
  );

  it.effect("does not clean or close when disconnect fails", () =>
    Effect.gen(function* () {
      const cleanup = vi.fn();
      const close = vi.fn();
      expect(
        yield* Effect.flip(
          runLogout(
            makeLogoutLayer({
              cleanup: Effect.sync(cleanup),
              close: Effect.sync(close),
              disconnect: Effect.fail(
                new WalletConnectionError({
                  cause: new Error("rejected"),
                  operation: "disconnect",
                })
              ),
            })
          )
        )
      ).toMatchObject({ _tag: "WalletConnectionError" });

      expect(cleanup).not.toHaveBeenCalled();
      expect(close).not.toHaveBeenCalled();
    })
  );

  it.effect("shares concurrent calls and permits a later retry", () =>
    Effect.gen(function* () {
      const started = yield* Deferred.make<void>();
      const release = yield* Deferred.make<void>();
      // Yield before signalling: Effect 4.0.2's cachedWithTTL starts the shared
      // run synchronously, so a caller resumed re-entrantly from inside that
      // start would join a run whose fiber is not yet assigned.
      const disconnect = vi.fn(() =>
        Effect.yieldNow.pipe(
          Effect.andThen(Deferred.succeed(started, undefined)),
          Effect.andThen(Deferred.await(release))
        )
      );
      const close = vi.fn();
      const cleanupError = new WalletStorageCleanupError({
        cause: new Error("blocked"),
      });
      const layer = makeLogoutLayer({
        cleanup: Effect.fail(cleanupError),
        close: Effect.sync(close),
        disconnect: Effect.suspend(disconnect),
      });

      const failures = yield* Effect.scoped(
        Effect.gen(function* () {
          const wallet = yield* WalletService;
          const first = yield* wallet.logout.pipe(
            Effect.flip,
            Effect.forkChild
          );
          yield* Deferred.await(started);
          const second = yield* wallet.logout.pipe(
            Effect.flip,
            Effect.forkChild({ startImmediately: true })
          );
          yield* Deferred.succeed(release, undefined);
          const concurrent = yield* Effect.all([
            Fiber.join(first),
            Fiber.join(second),
          ]);
          const retry = yield* wallet.logout.pipe(Effect.flip);
          return [...concurrent, retry];
        }).pipe(Effect.provide(layer))
      );

      expect(disconnect).toHaveBeenCalledTimes(2);
      expect(close).toHaveBeenCalledTimes(2);
      expect(failures).toEqual([cleanupError, cleanupError, cleanupError]);
    })
  );
});
