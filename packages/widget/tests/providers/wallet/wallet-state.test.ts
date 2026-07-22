import {
  Deferred,
  Effect,
  Fiber,
  Layer,
  Option,
  Stream,
  SubscriptionRef,
} from "effect";
import { mainnet, optimism } from "viem/chains";
import { describe, expect, it } from "vitest";
import type { Connector } from "wagmi";
import { normalizeWidgetConfig } from "../../../src/app/config/settings";
import { LegacyResourceSource } from "../../../src/services/api/legacy-resource-source";
import { YieldResourceSource } from "../../../src/services/api/yield-resource-source";
import { WidgetConfigService } from "../../../src/services/config/widget-config";
import { WidgetPersistence } from "../../../src/services/persistence/widget-persistence";
import { TrackingService } from "../../../src/services/tracking/tracking-service";
import { makeDefaultConfig } from "../../../src/services/wallet/default-wagmi-config";
import type { WalletCoreState } from "../../../src/services/wallet/domain/state";
import {
  SolanaPlatform,
  type SolanaRuntime,
} from "../../../src/services/wallet/platform/solana-platform";
import { WagmiPlatform } from "../../../src/services/wallet/platform/wagmi-platform";
import { WalletEnvironment } from "../../../src/services/wallet/platform/wallet-environment";
import type { WalletController } from "../../../src/services/wallet/wagmi-config";
import { WalletService } from "../../../src/services/wallet/wallet-service";
import { makeWalletStateRuntime } from "../../../src/services/wallet/wallet-state";
import { makeWalletTestController } from "./wallet-test-controller";

const address = "0x0000000000000000000000000000000000000001";

const disconnectedConnection = {
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
} as const satisfies WalletCoreState["connection"];

const connectedConnection = (
  connector: Connector
): WalletCoreState["connection"] => ({
  address,
  addresses: [address],
  chain: mainnet,
  chainId: mainnet.id,
  connector,
  isConnected: true,
  isConnecting: false,
  isDisconnected: false,
  isReconnecting: false,
  status: "connected",
});

const makeController = (
  wagmiConfig: ReturnType<typeof makeDefaultConfig>,
  actions: Parameters<typeof makeWalletTestController>[0]["actions"] = {}
) =>
  makeWalletTestController({
    actions,
    evmConfig: {
      evmChains: [mainnet],
      evmChainsMap: {
        ethereum: { skChainName: "ethereum", wagmiChain: mainnet },
      },
    },
    queryParamsInitChainId: undefined,
    wagmiConfig,
  });

describe("WalletService authoritative Wallet State", () => {
  it("keeps an in-flight command on its captured routing context", async () => {
    const firstStarted = await Effect.runPromise(Deferred.make<void>());
    const firstRelease = await Effect.runPromise(Deferred.make<void>());
    const firstConnector = {
      id: "first",
      name: "First",
      type: "injected",
      uid: "first-uid",
    } as unknown as Connector;
    const secondConnector = {
      id: "second",
      name: "Second",
      type: "injected",
      uid: "second-uid",
    } as unknown as Connector;
    const routed: string[] = [];
    const wagmiConfig = makeDefaultConfig();
    const controller = makeController(wagmiConfig, {
      signMessage: ({ connector }: { readonly connector: Connector }) =>
        Effect.gen(function* () {
          routed.push(connector.uid);
          if (connector.uid === firstConnector.uid) {
            yield* Deferred.succeed(firstStarted, undefined);
            yield* Deferred.await(firstRelease);
          }
          return connector.uid;
        }),
    });
    const core = await Effect.runPromise(
      SubscriptionRef.make<WalletCoreState>({
        connection: connectedConnection(firstConnector),
        connectors: [firstConnector, secondConnector],
      })
    );
    const settings = normalizeWidgetConfig({
      apiKey: "api-key",
      disableInjectedProviderDiscovery: true,
      variant: "default",
    });
    const configLayer = WidgetConfigService.layer({
      changes: Stream.never,
      current: Effect.succeed(settings),
      initial: settings,
    });
    const layer = WalletService.layer.pipe(
      Layer.provide(
        Layer.mergeAll(
          configLayer,
          Layer.succeed(LegacyResourceSource, {
            getEnabledNetworks: () => Effect.succeed(new Set(["ethereum"])),
          } as never),
          Layer.succeed(YieldResourceSource, {
            getOpportunity: () => Effect.die("unused"),
          } as never),
          Layer.succeed(
            WalletEnvironment,
            WalletEnvironment.of({
              href: Effect.succeed("https://widget.test/"),
              isLedgerDappBrowser: Effect.succeed(false),
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
          WidgetPersistence.layer
        )
      )
    );

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const wallet = yield* WalletService;
          const first = yield* wallet
            .signMessage({ message: "first" })
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
            connection: connectedConnection(secondConnector),
            connectors: [firstConnector, secondConnector],
          });
          yield* Fiber.join(changed);
          const second = yield* wallet.signMessage({ message: "second" });
          yield* Deferred.succeed(firstRelease, undefined);
          return { first: yield* Fiber.join(first), second };
        }).pipe(Effect.provide(layer))
      )
    );

    expect(result).toEqual({ first: "first-uid", second: "second-uid" });
    expect(routed).toEqual(["first-uid", "second-uid"]);
  });

  it("publishes a connected state only after enrichment completes", async () => {
    const enrichmentStarted = await Effect.runPromise(Deferred.make<void>());
    const enrichmentRelease = await Effect.runPromise(
      Deferred.make<ReadonlyArray<typeof optimism>>()
    );
    const connector = {
      $filteredChains: Stream.fromEffect(
        Effect.gen(function* () {
          yield* Deferred.succeed(enrichmentStarted, undefined);
          return yield* Deferred.await(enrichmentRelease);
        })
      ),
      id: "controlled",
      name: "Controlled",
      type: "controlled",
      uid: "controlled-uid",
    } as unknown as Connector;
    const controller = makeController(makeDefaultConfig());
    const core = await Effect.runPromise(
      SubscriptionRef.make<WalletCoreState>({
        connection: disconnectedConnection,
        connectors: [connector],
      })
    );

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* makeWalletStateRuntime({
            controller: controller as WalletController,
            core: {
              current: SubscriptionRef.get(core),
              states: SubscriptionRef.changes(core),
            },
            readStoredPublicKeys: Effect.succeed({}),
          });
          const connected = yield* state.contexts.pipe(
            Stream.filter(
              (context) => context.state.connection.status === "connected"
            ),
            Stream.runHead,
            Effect.map(Option.getOrThrow),
            Effect.forkChild({ startImmediately: true })
          );
          yield* SubscriptionRef.set(core, {
            connection: connectedConnection(connector),
            connectors: [connector],
          });
          yield* Deferred.await(enrichmentStarted);
          const whileEnriching = yield* state.context;
          yield* Deferred.succeed(enrichmentRelease, [optimism]);
          return {
            connected: yield* Fiber.join(connected),
            whileEnriching,
          };
        })
      )
    );

    expect(result.whileEnriching.state.connection.status).toBe("disconnected");
    expect(result.connected.state.connection).toMatchObject({
      connectorChains: [optimism],
      status: "connected",
    });
  });
});
