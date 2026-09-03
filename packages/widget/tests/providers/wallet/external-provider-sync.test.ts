import { describe, expect, it, vi } from "@effect/vitest";
import { Deferred, Effect, Stream } from "effect";
import { mainnet } from "viem/chains";
import type { Connector } from "wagmi";
import type {
  SettingsProps,
  SKExternalProviders,
} from "../../../src/public-api/types";
import {
  selectWidgetBootstrapSnapshot,
  WidgetConfigService,
} from "../../../src/services/config/widget-config";
import { makeDefaultConfig } from "../../../src/services/wallet/default-wagmi-config";
import type { WalletBootstrapResult } from "../../../src/services/wallet/internal/runtime/bootstrap";
import { installExternalProviderSynchronization } from "../../../src/services/wallet/internal/runtime/external-provider-sync";
import type {
  WalletStateContext,
  WalletStateRuntime,
} from "../../../src/services/wallet/internal/runtime/state";
import type { WalletCoreState } from "../../../src/services/wallet/wallet-state";
import { disconnectedNormalizedWalletState } from "../../../src/services/wallet/wallet-state";
import { getTestWidgetConfig } from "../../utils/widget-config";
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

const makeHarness = ({
  connect = () => Effect.void,
  connector,
  connected,
  settings = {},
}: {
  readonly connect?: () => Effect.Effect<void>;
  readonly connector: Connector | undefined;
  readonly connected: boolean;
  readonly settings?: Partial<
    Omit<
      Extract<SettingsProps, { readonly borrowEnabled?: false }>,
      "externalProviders"
    >
  >;
}) =>
  Effect.gen(function* () {
    const initial = getTestWidgetConfig({
      ...settings,
      apiKey: "api-key",
      borrowEnabled: false,
      externalProviders: externalProviders(),
      variant: "default",
    });
    const invariant = yield* Deferred.make<unknown>();
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
    const snapshot = initial.externalProviders!;
    const bootstrap = {
      controller,
      core: {
        current: Effect.succeed(context.core),
        states: Stream.never,
      },
      externalProviders: { current: snapshot },
      snapshot: {
        browser: {
          href: "https://widget.test/",
          isLedgerDappBrowser: false,
          isMobileWallet: false,
        },
        config: selectWidgetBootstrapSnapshot(initial),
        enabledNetworks: new Set(["ethereum"]),
        externalProviders: { current: snapshot },
        initParams: {} as never,
      },
    } satisfies WalletBootstrapResult;
    const configLayer = WidgetConfigService.layer({
      ...settings,
      apiKey: "api-key",
      borrowEnabled: false,
      externalProviders: externalProviders(),
      variant: "default",
    });
    return { bootstrap, configLayer, invariant, state };
  });

describe("external-provider synchronization", () => {
  it.effect(
    "updates live provider values and sends connector notifications",
    () =>
      Effect.gen(function* () {
        const accountsChanged = vi.fn();
        const chainChanged = vi.fn();
        const supportedChanged = vi.fn();
        const notified = Promise.withResolvers<void>();
        const connector = {
          id: "externalProviderConnector",
          name: "External",
          onAccountsChanged: (accounts: readonly string[]) => {
            accountsChanged(accounts);
            notified.resolve();
          },
          onChainChanged: chainChanged,
          onSupportedChainsChanged: supportedChanged,
          type: "externalProvider",
          uid: "external-uid",
        } as unknown as Connector;
        const harness = yield* makeHarness({ connector, connected: true });
        const nextProviders = externalProviders({
          currentAddress: secondAddress,
          currentChain: 10,
          supportedChainIds: [1, 10],
        });

        yield* Effect.scoped(
          Effect.gen(function* () {
            yield* installExternalProviderSynchronization(harness);
            const config = yield* WidgetConfigService;
            yield* config.update({
              apiKey: "api-key",
              externalProviders: nextProviders,
              variant: "default",
            });
            yield* Effect.promise(() => notified.promise);
            yield* Effect.yieldNow;
          }).pipe(Effect.provide(harness.configLayer))
        );

        expect(harness.bootstrap.externalProviders?.current).toEqual(
          getTestWidgetConfig({
            apiKey: "api-key",
            externalProviders: nextProviders,
            variant: "default",
          }).externalProviders
        );
        expect(accountsChanged).toHaveBeenCalledWith([secondAddress]);
        expect(chainChanged).toHaveBeenCalledWith("10");
        expect(supportedChanged).toHaveBeenCalledWith({
          currentChainId: 10,
          supportedChainIds: [1, 10],
        });
      })
  );

  it.effect(
    "does not start a duplicate automatic connection while one is pending",
    () =>
      Effect.gen(function* () {
        const started = yield* Deferred.make<void>();
        const release = yield* Deferred.make<void>();
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
        const harness = yield* makeHarness({
          connect,
          connector,
          connected: false,
        });

        yield* Effect.scoped(
          Effect.gen(function* () {
            yield* installExternalProviderSynchronization(harness);
            yield* Deferred.await(started);
            const config = yield* WidgetConfigService;
            yield* config.update({
              apiKey: "api-key",
              externalProviders: externalProviders({ currentChain: 10 }),
              variant: "default",
            });
            yield* Effect.yieldNow;
            expect(connect).toHaveBeenCalledOnce();
            yield* Deferred.succeed(release, undefined);
          }).pipe(Effect.provide(harness.configLayer))
        );
      })
  );

  it.effect(
    "keeps synchronizing when only host functions change identity",
    () =>
      Effect.gen(function* () {
        const notified = Promise.withResolvers<void>();
        const connector = {
          id: "externalProviderConnector",
          name: "External",
          onAccountsChanged: () => {
            notified.resolve();
          },
          onChainChanged: () => undefined,
          onSupportedChainsChanged: () => undefined,
          type: "externalProvider",
          uid: "external-uid",
        } as unknown as Connector;
        const harness = yield* makeHarness({
          connected: true,
          connector,
          settings: { mapWalletFn: (wallet) => wallet },
        });

        const failed = yield* Effect.scoped(
          Effect.gen(function* () {
            yield* installExternalProviderSynchronization(harness);
            const config = yield* WidgetConfigService;
            yield* config.update({
              apiKey: "api-key",
              externalProviders: externalProviders({
                currentAddress: secondAddress,
              }),
              mapWalletFn: (wallet) => wallet,
              variant: "default",
            });
            yield* Effect.promise(() => notified.promise);
            yield* Effect.yieldNow;

            return yield* Deferred.isDone(harness.invariant);
          }).pipe(Effect.provide(harness.configLayer))
        );

        expect(failed).toBe(false);
        expect(
          harness.bootstrap.externalProviders?.current.currentAddress
        ).toBe(secondAddress);
      })
  );

  it.effect("keeps synchronizing when a comparable wallet field changes", () =>
    Effect.gen(function* () {
      const notified = Promise.withResolvers<void>();
      const connector = {
        id: "externalProviderConnector",
        name: "External",
        onAccountsChanged: () => {
          notified.resolve();
        },
        onChainChanged: () => undefined,
        onSupportedChainsChanged: () => undefined,
        type: "externalProvider",
        uid: "external-uid",
      } as unknown as Connector;
      const harness = yield* makeHarness({ connected: true, connector });

      const failed = yield* Effect.scoped(
        Effect.gen(function* () {
          yield* installExternalProviderSynchronization(harness);
          const config = yield* WidgetConfigService;
          yield* config.update({
            apiKey: "api-key",
            externalProviders: externalProviders({
              currentAddress: secondAddress,
            }),
            isSafe: true,
            variant: "default",
          });
          yield* Effect.promise(() => notified.promise);
          yield* Effect.yieldNow;

          return yield* Deferred.isDone(harness.invariant);
        }).pipe(Effect.provide(harness.configLayer))
      );

      expect(failed).toBe(false);
      expect(harness.bootstrap.externalProviders?.current.currentAddress).toBe(
        secondAddress
      );
    })
  );

  it.effect(
    "fails the runtime when the fixed external connector is missing",
    () =>
      Effect.gen(function* () {
        const harness = yield* makeHarness({
          connector: undefined,
          connected: false,
        });

        const failure = yield* Effect.scoped(
          Effect.gen(function* () {
            yield* installExternalProviderSynchronization(harness);
            return yield* Deferred.await(harness.invariant);
          }).pipe(Effect.provide(harness.configLayer))
        );

        expect(failure).toMatchObject({
          _tag: "WalletRuntimeInvariantError",
          reason: "external-provider-connector-missing",
        });
      })
  );
});
