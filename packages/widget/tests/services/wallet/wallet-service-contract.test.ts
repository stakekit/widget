import { describe, expect, it } from "@effect/vitest";
import {
  Deferred,
  Effect,
  Fiber,
  Layer,
  Option,
  Stream,
  SubscriptionRef,
} from "effect";
import { BaseError, UserRejectedRequestError, zeroAddress } from "viem";
import { mainnet, optimism } from "viem/chains";
import { expectTypeOf } from "vitest";
import type { Connector } from "wagmi";
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
import { WagmiPlatform } from "../../../src/services/wallet/internal/platform/wagmi-platform";
import { WalletEnvironment } from "../../../src/services/wallet/internal/platform/wallet-environment";
import { WalletStorageCleanup } from "../../../src/services/wallet/internal/runtime/wallet-storage-cleanup";
import { WalletBootstrapSource } from "../../../src/services/wallet/wallet-bootstrap-source";
import { WalletConnectorSource } from "../../../src/services/wallet/wallet-connector-source";
import {
  WalletBroadcastError,
  WalletIntegrationError,
  type WalletRuntimeInvariantError,
  WalletSigningError,
} from "../../../src/services/wallet/wallet-errors";
import { WalletModal } from "../../../src/services/wallet/wallet-modal";
import { WalletService } from "../../../src/services/wallet/wallet-service";
import type { WalletCoreState } from "../../../src/services/wallet/wallet-state";
import type { BorrowTransactionMeta } from "../../../src/services/wallet/wallet-transactions";
import { makeWalletTestController } from "./wallet-test-controller";

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
}: {
  readonly address?: `0x${string}`;
  readonly chain?: typeof mainnet | typeof optimism;
} = {}): WalletCoreState["connection"] => ({
  address,
  addresses: [address],
  chain,
  chainId: chain.id,
  connector,
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
    readonly message: string;
  }) => Effect.Effect<string>;
}) => {
  const settings = {
    apiKey: "api-key",
    disableInjectedProviderDiscovery: true,
    variant: "default" as const,
  };
  const configLayer = WidgetConfigService.layer(settings);
  const controller = makeWalletTestController({
    actions:
      failure === undefined
        ? {
            sendEvmTransaction: () =>
              Effect.succeed({ broadcasted: true, signedTx: transactionHash }),
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
          },
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

  return WalletService.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        configLayer,
        WalletConnectorSource.defaultLayer,
        Layer.succeed(WalletBootstrapSource, {
          getEnabledWalletNetworks: Effect.succeed(
            new Set<WalletNetwork>(["ethereum", "optimism"])
          ),
          getOpportunity: () => Effect.die("unused"),
        }),
        Layer.succeed(
          WalletEnvironment,
          WalletEnvironment.of({
            href: Effect.succeed("https://widget.test/"),
            isMobileWallet: Effect.succeed(false),
          })
        ),
        Layer.succeed(
          SolanaPlatform,
          SolanaPlatform.of({
            makeRuntime: () =>
              Effect.succeed({
                connection: {} as SolanaRuntime["connection"],
                current: Effect.succeed({ wallets: [] }),
                states: Stream.never,
              }),
          })
        ),
        Layer.succeed(
          WagmiPlatform,
          WagmiPlatform.of({
            buildConfig: () => Effect.succeed(controller),
            initialize: () => Effect.void,
            observeCore: () =>
              Effect.succeed({
                current: SubscriptionRef.get(core),
                states: SubscriptionRef.changes(core),
              }),
          })
        ),
        TrackingService.layer.pipe(Layer.provide(configLayer)),
        WalletModal.layer,
        WalletStorageCleanup.layer,
        WidgetPersistence.layer
      )
    )
  );
};

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
  it("defines Effect commands without a React dependency", () => {
    expectTypeOf<
      WalletService["Service"]["addLedgerAccount"]
    >().returns.toEqualTypeOf<
      Effect.Effect<
        | Readonly<{ readonly _tag: "Added" }>
        | Readonly<{ readonly _tag: "RejectedStale" }>,
        WalletIntegrationError | WalletRuntimeInvariantError
      >
    >();
  });

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
