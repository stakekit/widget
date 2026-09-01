import { describe, expect, it } from "@effect/vitest";
import {
  Deferred,
  Effect,
  Fiber,
  Layer,
  Option,
  Ref,
  Stream,
  SubscriptionRef,
} from "effect";
import type { Chain } from "viem";
import { mainnet, optimism } from "viem/chains";
import type { Connector } from "wagmi";
import { WidgetConfigService } from "../../../src/services/config/widget-config";
import { WidgetPersistence } from "../../../src/services/persistence/widget-persistence";
import { TrackingService } from "../../../src/services/tracking/tracking-service";
import { makeDefaultConfig } from "../../../src/services/wallet/default-wagmi-config";
import {
  SolanaPlatform,
  type SolanaRuntime,
} from "../../../src/services/wallet/internal/platform/solana-platform";
import { WagmiPlatform } from "../../../src/services/wallet/internal/platform/wagmi-platform";
import { WalletEnvironment } from "../../../src/services/wallet/internal/platform/wallet-environment";
import { makeWalletStateRuntime } from "../../../src/services/wallet/internal/runtime/state";
import type { WalletController } from "../../../src/services/wallet/internal/runtime/wagmi-config";
import { WalletStorageCleanup } from "../../../src/services/wallet/internal/runtime/wallet-storage-cleanup";
import { WalletBootstrapSource } from "../../../src/services/wallet/wallet-bootstrap-source";
import { WalletConnectorSource } from "../../../src/services/wallet/wallet-connector-source";
import { WalletModal } from "../../../src/services/wallet/wallet-modal";
import { WalletService } from "../../../src/services/wallet/wallet-service";
import type { WalletCoreState } from "../../../src/services/wallet/wallet-state";
import { makeWalletTestController } from "./wallet-test-controller";

const address = "0x0000000000000000000000000000000000000001";
const nextAddress = "0x0000000000000000000000000000000000000002";

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

const reconnectingConnection = {
  ...disconnectedConnection,
  isDisconnected: false,
  isReconnecting: true,
  status: "reconnecting",
} as const satisfies WalletCoreState["connection"];

const makeController = (
  wagmiConfig: ReturnType<typeof makeDefaultConfig>,
  actions: Parameters<typeof makeWalletTestController>[0]["actions"] = {}
) =>
  makeWalletTestController({
    actions,
    evmConfig: {
      evmChains: [mainnet],
      evmChainsMap: {
        ethereum: { network: "ethereum", wagmiChain: mainnet },
      },
    },
    queryParamsInitChainId: undefined,
    wagmiConfig,
  });

describe("WalletService authoritative Wallet State", () => {
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
      const wagmiConfig = makeDefaultConfig();
      const controller = makeController(wagmiConfig, {
        signMessage: ({
          connector,
          message,
        }: {
          readonly connector: Connector;
          readonly message: string;
        }) =>
          Effect.gen(function* () {
            routed.push(connector.uid);
            if (message === "first") {
              yield* Deferred.succeed(firstStarted, undefined);
              yield* Deferred.await(firstRelease);
            }
            return connector.uid;
          }),
      });
      const core = yield* SubscriptionRef.make<WalletCoreState>({
        connection: connectedConnection(firstConnector),
        connectors: [firstConnector, secondConnector],
      });
      const settings = {
        apiKey: "api-key",
        disableInjectedProviderDiscovery: true,
        variant: "default" as const,
      };
      const configLayer = WidgetConfigService.layer(settings);
      const layer = WalletService.layer.pipe(
        Layer.provide(
          Layer.mergeAll(
            configLayer,
            WalletConnectorSource.defaultLayer,
            Layer.succeed(WalletBootstrapSource, {
              getEnabledWalletNetworks: () =>
                Effect.succeed(new Set(["ethereum"])),
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

      const result = yield* Effect.scoped(
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
          yield* Deferred.await(enrichmentStarted);
          const duringTransition = yield* wallet
            .signMessage({ message: "during-transition" })
            .pipe(Effect.result);
          yield* Deferred.succeed(enrichmentRelease, [mainnet]);
          yield* Fiber.join(changed);
          const second = yield* wallet.signMessage({ message: "second" });
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
            _tag: "WalletCapabilityUnavailableError",
            capability: "message",
          },
        },
        first: "first-uid",
        second: "second-uid",
      });
      expect(routed).toEqual(["first-uid", "second-uid"]);
    })
  );

  it.effect("publishes a connecting state until enrichment completes", () =>
    Effect.gen(function* () {
      const enrichmentStarted = yield* Deferred.make<void>();
      const enrichmentRelease = yield* Deferred.make<ReadonlyArray<Chain>>();
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
      const core = yield* SubscriptionRef.make<WalletCoreState>({
        connection: disconnectedConnection,
        connectors: [connector],
      });

      const result = yield* Effect.scoped(
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
      );

      expect(result.whileEnriching.state.connection).toMatchObject({
        address,
        chain: mainnet,
        connector,
        network: "ethereum",
        status: "connecting",
      });
      expect(result.connected.state.connection).toMatchObject({
        connectorChains: [optimism],
        status: "connected",
      });
    })
  );

  it.effect("keeps the last Wallet Scope Owner through a reconnect gap", () =>
    Effect.gen(function* () {
      const connector = {
        id: "stable",
        name: "Stable",
        type: "injected",
        uid: "stable-uid",
      } as unknown as Connector;
      const controller = makeController(makeDefaultConfig());
      const core = yield* SubscriptionRef.make<WalletCoreState>({
        connection: connectedConnection(connector),
        connectors: [connector],
      });

      const result = yield* Effect.scoped(
        Effect.gen(function* () {
          const state = yield* makeWalletStateRuntime({
            controller: controller as WalletController,
            core: {
              current: SubscriptionRef.get(core),
              states: SubscriptionRef.changes(core),
            },
            readStoredPublicKeys: Effect.succeed({}),
          });
          const connecting = yield* state.contexts.pipe(
            Stream.filter(
              (context) => context.state.connection.status === "connecting"
            ),
            Stream.runHead,
            Effect.map(Option.getOrThrow),
            Effect.forkChild({ startImmediately: true })
          );
          yield* SubscriptionRef.set(core, {
            connection: reconnectingConnection,
            connectors: [connector],
          });
          return yield* Fiber.join(connecting);
        })
      );

      expect(result.state.connection).toMatchObject({
        address,
        chain: mainnet,
        connector,
        network: "ethereum",
        status: "connecting",
      });
    })
  );

  it.effect(
    "publishes a new Wallet Scope Owner before connector enrichment completes",
    () =>
      Effect.gen(function* () {
        const connector = {
          id: "stable",
          name: "Stable",
          type: "injected",
          uid: "stable-uid",
        } as unknown as Connector;
        const controller = makeController(makeDefaultConfig());
        const core = yield* SubscriptionRef.make<WalletCoreState>({
          connection: connectedConnection(connector),
          connectors: [connector],
        });

        const result = yield* Effect.scoped(
          Effect.gen(function* () {
            const state = yield* makeWalletStateRuntime({
              controller: controller as WalletController,
              core: {
                current: SubscriptionRef.get(core),
                states: SubscriptionRef.changes(core),
              },
              readStoredPublicKeys: Effect.succeed({}),
            });
            const changed = yield* state.contexts.pipe(
              Stream.filter(
                (context) =>
                  context.state.connection.status === "connecting" &&
                  context.state.connection.address === nextAddress
              ),
              Stream.runHead,
              Effect.map(Option.getOrThrow),
              Effect.forkChild({ startImmediately: true })
            );
            yield* SubscriptionRef.set(core, {
              connection: {
                ...reconnectingConnection,
                address: nextAddress,
                addresses: [nextAddress],
                chain: mainnet,
                chainId: mainnet.id,
              },
              connectors: [connector],
            });
            return yield* Fiber.join(changed);
          })
        );

        expect(result.state.connection).toMatchObject({
          address: nextAddress,
          chain: mainnet,
          connector,
          network: "ethereum",
          status: "connecting",
        });
      })
  );

  it.effect(
    "keeps commands available when only the connector inventory changes",
    () =>
      Effect.gen(function* () {
        const enrichmentStarted = yield* Deferred.make<void>();
        const enrichmentRelease = yield* Deferred.make<ReadonlyArray<Chain>>();
        const subscriptions = yield* Ref.make(0);
        const connector = {
          $filteredChains: Stream.fromEffect(
            Ref.getAndUpdate(subscriptions, (count) => count + 1).pipe(
              Effect.flatMap((count) =>
                count === 0
                  ? Effect.succeed<ReadonlyArray<Chain>>([mainnet])
                  : Effect.gen(function* () {
                      yield* Deferred.succeed(enrichmentStarted, undefined);
                      return yield* Deferred.await(enrichmentRelease);
                    })
              )
            )
          ),
          id: "stable",
          name: "Stable",
          type: "injected",
          uid: "stable-uid",
        } as unknown as Connector;
        const discoveredConnector = {
          id: "discovered",
          name: "Discovered",
          type: "injected",
          uid: "discovered-uid",
        } as unknown as Connector;
        const connection = connectedConnection(connector);
        const controller = makeController(makeDefaultConfig());
        const core = yield* SubscriptionRef.make<WalletCoreState>({
          connection,
          connectors: [connector],
        });

        const result = yield* Effect.scoped(
          Effect.gen(function* () {
            const state = yield* makeWalletStateRuntime({
              controller: controller as WalletController,
              core: {
                current: SubscriptionRef.get(core),
                states: SubscriptionRef.changes(core),
              },
              readStoredPublicKeys: Effect.succeed({}),
            });
            yield* SubscriptionRef.set(core, {
              connection,
              connectors: [connector, discoveredConnector],
            });
            yield* Deferred.await(enrichmentStarted);
            const whileEnriching = yield* state.context;
            yield* Deferred.succeed(enrichmentRelease, [optimism]);

            return whileEnriching;
          })
        );

        expect(result.state.connection).toMatchObject({
          connector,
          status: "connected",
        });
      })
  );

  it.effect(
    "retires the previous connector while Cosmos enrichment is pending",
    () =>
      Effect.gen(function* () {
        const publicKey = "A".repeat(44);
        const enrichmentStarted = yield* Deferred.make<void>();
        const enrichmentRelease =
          yield* Deferred.make<Record<string, string>>();
        const firstConnector = {
          id: "first",
          name: "First",
          type: "injected",
          uid: "first-uid",
        } as unknown as Connector;
        const cosmosConnector = {
          $chainWallet: Stream.succeed({ chainId: "cosmoshub-4" } as never),
          id: "cosmos",
          name: "Cosmos",
          toBase64: () => "unused",
          type: "cosmosProvider",
          uid: "cosmos-uid",
        } as unknown as Connector;
        const controller = makeController(makeDefaultConfig());
        const core = yield* SubscriptionRef.make<WalletCoreState>({
          connection: connectedConnection(firstConnector),
          connectors: [firstConnector, cosmosConnector],
        });

        const result = yield* Effect.scoped(
          Effect.gen(function* () {
            const state = yield* makeWalletStateRuntime({
              controller: controller as WalletController,
              core: {
                current: SubscriptionRef.get(core),
                states: SubscriptionRef.changes(core),
              },
              readStoredPublicKeys: Effect.gen(function* () {
                yield* Deferred.succeed(enrichmentStarted, undefined);
                return yield* Deferred.await(enrichmentRelease);
              }),
            });
            const connected = yield* state.contexts.pipe(
              Stream.filter(
                (context) =>
                  context.state.connection.status === "connected" &&
                  context.state.connection.connector.uid === cosmosConnector.uid
              ),
              Stream.runHead,
              Effect.map(Option.getOrThrow),
              Effect.forkChild({ startImmediately: true })
            );
            yield* SubscriptionRef.set(core, {
              connection: connectedConnection(cosmosConnector),
              connectors: [firstConnector, cosmosConnector],
            });
            yield* Deferred.await(enrichmentStarted);
            const whileEnriching = yield* state.context;
            yield* Deferred.succeed(enrichmentRelease, {
              [address]: publicKey,
            });

            return {
              connected: yield* Fiber.join(connected),
              whileEnriching,
            };
          })
        );

        expect(result.whileEnriching.state.connection.status).toBe(
          "connecting"
        );
        expect(result.connected.state.connection).toMatchObject({
          additionalAddresses: { cosmosPubKey: publicKey },
          status: "connected",
        });
      })
  );
});
