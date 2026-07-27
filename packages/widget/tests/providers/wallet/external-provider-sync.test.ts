import { Deferred, Effect, Stream, SubscriptionRef } from "effect";
import { mainnet } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import type { Connector } from "wagmi";
import { normalizeWidgetConfig } from "../../../src/app/config/settings";
import type {
  SettingsProps,
  SKExternalProviders,
} from "../../../src/public-api/types";
import {
  normalizeWidgetBootstrapConfig,
  WidgetConfigService,
} from "../../../src/services/config/widget-config";
import {
  makeExternalProviderSnapshot,
  type WalletBootstrapResult,
} from "../../../src/services/wallet/bootstrap";
import { makeDefaultConfig } from "../../../src/services/wallet/default-wagmi-config";
import type { WalletCoreState } from "../../../src/services/wallet/domain/state";
import { disconnectedNormalizedWalletState } from "../../../src/services/wallet/domain/state";
import { installExternalProviderSynchronization } from "../../../src/services/wallet/external-provider-sync";
import type {
  WalletStateContext,
  WalletStateRuntime,
} from "../../../src/services/wallet/wallet-state";
import { makeWalletTestController } from "./wallet-test-controller";

const firstAddress = "0x0000000000000000000000000000000000000001";
const secondAddress = "0x0000000000000000000000000000000000000002";

const externalProviders = (
  overrides: Partial<SKExternalProviders> = {}
): SKExternalProviders => ({
  currentAddress: firstAddress,
  currentChain: 1,
  provider: {
    sendTransaction: async () => "transaction-hash",
    signMessage: async () => "signature",
    switchChain: async () => undefined,
  },
  supportedChainIds: [1],
  type: "generic",
  ...overrides,
});

const disconnectedCore = {
  address: undefined,
  addresses: undefined,
  chain: undefined,
  chainId: undefined,
  connector: undefined,
  isConnected: false,
  isConnecting: false,
  isDisconnected: true,
  isReconnecting: false,
  status: "disconnected",
} as const;

const makeContext = (
  connector: Connector | undefined,
  connected: boolean
): WalletStateContext => ({
  core: {
    connection: connected
      ? ({
          address: firstAddress,
          addresses: [firstAddress],
          chain: mainnet,
          chainId: mainnet.id,
          connector,
          isConnected: true,
          isConnecting: false,
          isDisconnected: false,
          isReconnecting: false,
          status: "connected",
        } as WalletCoreState["connection"])
      : disconnectedCore,
    connectors: connector ? [connector] : [],
  },
  routing: {} as never,
  state: {
    connection: disconnectedNormalizedWalletState,
    ledger: {
      accounts: [],
      currentAccountId: undefined,
      disabledChains: [],
    },
  },
});

const makeHarness = async ({
  connect = () => Effect.void,
  connector,
  connected,
  settings = {},
}: {
  readonly connect?: () => Effect.Effect<void>;
  readonly connector: Connector | undefined;
  readonly connected: boolean;
  readonly settings?: Partial<SettingsProps>;
}) => {
  const initial = normalizeWidgetConfig({
    ...settings,
    apiKey: "api-key",
    externalProviders: externalProviders(),
    variant: "default",
  });
  const config = await Effect.runPromise(SubscriptionRef.make(initial));
  const invariant = await Effect.runPromise(Deferred.make<unknown>());
  const context = makeContext(connector, connected);
  const state = {
    context: Effect.succeed(context),
    contexts: Stream.concat(Stream.succeed(context), Stream.never),
    failInvariant: (error) =>
      Deferred.succeed(invariant, error).pipe(Effect.asVoid),
  } satisfies WalletStateRuntime;
  const wagmiConfig = makeDefaultConfig();
  const controller = makeWalletTestController({
    actions: { connect },
    queryParamsInitChainId: undefined,
    wagmiConfig,
  });
  const snapshot = makeExternalProviderSnapshot(initial)!;
  const bootstrap = {
    controller,
    core: {
      current: Effect.succeed(context.core),
      states: Stream.never,
    },
    externalProviderMode: true,
    externalProviders: { current: snapshot },
    snapshot: {
      browser: {
        href: "https://widget.test/",
        isLedgerDappBrowser: false,
        isMobileWallet: false,
      },
      config: normalizeWidgetBootstrapConfig({
        isLedgerLive: initial.isLedgerLive,
        settings: initial,
      }),
      enabledNetworks: new Set(["ethereum"]),
      externalProviders: { current: snapshot },
      initParams: {} as never,
    },
  } satisfies WalletBootstrapResult;
  const configLayer = WidgetConfigService.layer({
    changes: SubscriptionRef.changes(config),
    current: SubscriptionRef.get(config),
    initial,
  });
  return { bootstrap, config, configLayer, invariant, state };
};

describe("external-provider synchronization", () => {
  it("updates live provider values and sends connector notifications", async () => {
    const accountsChanged = vi.fn();
    const chainChanged = vi.fn();
    const supportedChanged = vi.fn();
    const notified = await Effect.runPromise(Deferred.make<void>());
    const connector = {
      id: "externalProviderConnector",
      name: "External",
      onAccountsChanged: (accounts: readonly string[]) => {
        accountsChanged(accounts);
        void Effect.runPromise(Deferred.succeed(notified, undefined));
      },
      onChainChanged: chainChanged,
      onSupportedChainsChanged: supportedChanged,
      type: "externalProvider",
      uid: "external-uid",
    } as unknown as Connector;
    const harness = await makeHarness({ connector, connected: true });
    const nextProviders = externalProviders({
      currentAddress: secondAddress,
      currentChain: 10,
      supportedChainIds: [1, 10],
    });

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* installExternalProviderSynchronization(harness);
          yield* SubscriptionRef.set(
            harness.config,
            normalizeWidgetConfig({
              apiKey: "api-key",
              externalProviders: nextProviders,
              variant: "default",
            })
          );
          yield* Deferred.await(notified);
          yield* Effect.yieldNow;
        }).pipe(Effect.provide(harness.configLayer))
      )
    );

    expect(harness.bootstrap.externalProviders?.current).toEqual(
      makeExternalProviderSnapshot(
        normalizeWidgetConfig({
          apiKey: "api-key",
          externalProviders: nextProviders,
          variant: "default",
        })
      )
    );
    expect(accountsChanged).toHaveBeenCalledWith([secondAddress]);
    expect(chainChanged).toHaveBeenCalledWith("10");
    expect(supportedChanged).toHaveBeenCalledWith({
      currentChainId: 10,
      supportedChainIds: [1, 10],
    });
  });

  it("does not start a duplicate automatic connection while one is pending", async () => {
    const started = await Effect.runPromise(Deferred.make<void>());
    const release = await Effect.runPromise(Deferred.make<void>());
    const connect = vi.fn(() =>
      Effect.gen(function* () {
        yield* Deferred.succeed(started, undefined);
        yield* Deferred.await(release);
      })
    );
    const connector = {
      id: "externalProviderConnector",
      name: "External",
      onAccountsChanged: () => undefined,
      onChainChanged: () => undefined,
      onSupportedChainsChanged: () => undefined,
      type: "externalProvider",
      uid: "external-uid",
    } as unknown as Connector;
    const harness = await makeHarness({ connect, connector, connected: false });

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* installExternalProviderSynchronization(harness);
          yield* Deferred.await(started);
          const current = yield* SubscriptionRef.get(harness.config);
          yield* SubscriptionRef.set(harness.config, {
            ...current,
            externalProviders: externalProviders({ currentChain: 10 }),
          });
          yield* Effect.yieldNow;
          expect(connect).toHaveBeenCalledOnce();
          yield* Deferred.succeed(release, undefined);
        }).pipe(Effect.provide(harness.configLayer))
      )
    );
  });

  it("keeps synchronizing when only host functions change identity", async () => {
    const notified = await Effect.runPromise(Deferred.make<void>());
    const connector = {
      id: "externalProviderConnector",
      name: "External",
      onAccountsChanged: () => {
        void Effect.runPromise(Deferred.succeed(notified, undefined));
      },
      onChainChanged: () => undefined,
      onSupportedChainsChanged: () => undefined,
      type: "externalProvider",
      uid: "external-uid",
    } as unknown as Connector;
    const harness = await makeHarness({
      connected: true,
      connector,
      settings: { mapWalletFn: (wallet) => wallet },
    });

    const failed = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* installExternalProviderSynchronization(harness);
          yield* SubscriptionRef.set(
            harness.config,
            normalizeWidgetConfig({
              apiKey: "api-key",
              externalProviders: externalProviders({
                currentAddress: secondAddress,
              }),
              mapWalletFn: (wallet) => wallet,
              variant: "default",
            })
          );
          yield* Deferred.await(notified);
          yield* Effect.yieldNow;

          return yield* Deferred.isDone(harness.invariant);
        }).pipe(Effect.provide(harness.configLayer))
      )
    );

    expect(failed).toBe(false);
    expect(harness.bootstrap.externalProviders?.current.currentAddress).toBe(
      secondAddress
    );
  });

  it("fails the runtime when a comparable wallet field changes", async () => {
    const connector = {
      id: "externalProviderConnector",
      name: "External",
      onAccountsChanged: () => undefined,
      onChainChanged: () => undefined,
      onSupportedChainsChanged: () => undefined,
      type: "externalProvider",
      uid: "external-uid",
    } as unknown as Connector;
    const harness = await makeHarness({ connected: true, connector });

    const failure = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* installExternalProviderSynchronization(harness);
          yield* SubscriptionRef.set(
            harness.config,
            normalizeWidgetConfig({
              apiKey: "api-key",
              externalProviders: externalProviders(),
              isSafe: true,
              variant: "default",
            })
          );

          return yield* Deferred.await(harness.invariant);
        }).pipe(Effect.provide(harness.configLayer))
      )
    );

    expect(failure).toMatchObject({
      _tag: "WalletRuntimeInvariantError",
      reason: "wallet-topology-changed",
    });
  });

  it("fails the runtime when the fixed external connector is missing", async () => {
    const harness = await makeHarness({
      connector: undefined,
      connected: false,
    });

    const failure = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* installExternalProviderSynchronization(harness);
          return yield* Deferred.await(harness.invariant);
        }).pipe(Effect.provide(harness.configLayer))
      )
    );

    expect(failure).toMatchObject({
      _tag: "WalletRuntimeInvariantError",
      reason: "external-provider-connector-missing",
    });
  });
});
