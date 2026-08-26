import { RegistryProvider, useAtomValue } from "@effect/atom-react";
import {
  type Adapter,
  type WalletName,
  WalletReadyState,
} from "@solana/wallet-adapter-base";
import type { Connection } from "@solana/web3.js";
import { Array as EArray, Effect, Layer, Option, Queue, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { HttpResponse, http } from "msw";
import {
  Component,
  type PropsWithChildren,
  StrictMode,
  useContext,
  useEffect,
} from "react";
import type { Address } from "viem";
import {
  type Config,
  createConfig,
  createConnector,
  useAccount,
  useConnect,
  useConnectors,
  useDisconnect,
  useSwitchChain,
  WagmiContext,
  http as wagmiHttp,
} from "wagmi";
import { watchConnectors } from "wagmi/actions";
import { optimism } from "wagmi/chains";
import { ThirdPartyQueryClientProvider } from "../../src/app/composition/providers/query-client";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { applicationBaseRuntime } from "../../src/app/runtime/application-base-runtime";
import { walletConnectorSourceRuntime } from "../../src/app/runtime/wallet-connector-source-runtime";
import { walletRuntime } from "../../src/app/runtime/wallet-runtime";
import { WagmiConfigProvider } from "../../src/features/wallet/composition";
import {
  useWalletConfig,
  walletStateResultAtom,
} from "../../src/features/wallet/index";
import { GeoBlockService } from "../../src/services/geoblocking";
import { solana } from "../../src/services/wallet/internal/adapters/configured-chains";
import type { SolanaRuntime } from "../../src/services/wallet/internal/platform/solana-platform";
import { installSolanaConnectorMembership } from "../../src/services/wallet/internal/runtime/solana-connector-membership";
import type {
  SolanaWalletDescriptor,
  SolanaWalletSnapshot,
} from "../../src/services/wallet/internal/runtime/solana-runtime";
import { WalletConnectorSource } from "../../src/services/wallet/wallet-connector-source";
import { WalletService } from "../../src/services/wallet/wallet-service";
import { yieldApiRoute } from "../mocks/api-routes";
import { mockDelay } from "../mocks/delay";
import { TestAtomRuntimeProvider } from "../utils/atom-runtime-provider";
import { rkMockWallet } from "../utils/mock-connector";
import { describe, expect, it, vi } from "../utils/test-extend";
import { render, renderHook } from "../utils/test-utils";
import { getTestWidgetConfig } from "../utils/widget-config";

const baseConnectorSourceProbeAtom = applicationBaseRuntime.atom(
  WalletConnectorSource.use((source) => Effect.succeed(source))
);
const appConnectorSourceProbeAtom = appRuntime.atom(
  WalletConnectorSource.use((source) => Effect.succeed(source))
);
const walletConnectorSourceProbeAtom = walletRuntime.atom(
  WalletConnectorSource.use((source) => Effect.succeed(source))
);

const RuntimeConnectorSourceObserver = ({
  onSources,
}: {
  readonly onSources: (
    sources: readonly [
      WalletConnectorSource["Service"],
      WalletConnectorSource["Service"],
      WalletConnectorSource["Service"],
    ]
  ) => void;
}) => {
  const baseSource = useAtomValue(baseConnectorSourceProbeAtom);
  const appSource = useAtomValue(appConnectorSourceProbeAtom);
  const walletSource = useAtomValue(walletConnectorSourceProbeAtom);

  useEffect(() => {
    if (
      AsyncResult.isSuccess(baseSource) &&
      AsyncResult.isSuccess(appSource) &&
      AsyncResult.isSuccess(walletSource)
    ) {
      onSources([baseSource.value, appSource.value, walletSource.value]);
    }
  }, [appSource, baseSource, onSources, walletSource]);

  return null;
};

class RuntimeErrorBoundary extends Component<
  PropsWithChildren<{ readonly onError: (error: unknown) => void }>,
  { readonly failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    this.props.onError(error);
  }

  override render() {
    return this.state.failed ? <div>runtime failed</div> : this.props.children;
  }
}

const useWagmiProviderContract = () => ({
  contextConfig: useContext(WagmiContext) as Config | undefined,
  walletConfig: useWalletConfig(),
});

const ConfigObserver = ({
  onConfig,
}: {
  readonly onConfig: (config: Config) => void;
}) => {
  const walletConfig = useWalletConfig();
  const config = walletConfig.pipe(AsyncResult.value, Option.getOrUndefined);

  useEffect(() => {
    if (config) onConfig(config);
  });

  return null;
};

const useRainbowKitWagmiContract = () => ({
  account: useAccount(),
  connect: useConnect(),
  connectors: useConnectors(),
  contextConfig: useContext(WagmiContext) as Config | undefined,
  walletConfig: useWalletConfig(),
  disconnect: useDisconnect(),
  switchChain: useSwitchChain(),
  walletProjection: useAtomValue(walletStateResultAtom),
});

const solanaAccount = "0x0000000000000000000000000000000000000501" as Address;

const makeSolanaAdapter = (name: string) =>
  ({ name: name as WalletName }) as Adapter;

const makeSolanaDescriptor = (
  adapter: Adapter,
  source: SolanaWalletDescriptor["source"],
  readyState: WalletReadyState
): SolanaWalletDescriptor => ({ adapter, readyState, source });

const makeSolanaConnectorFactory = (wallet: SolanaWalletDescriptor) =>
  createConnector((config) => ({
    $filteredChains: Stream.succeed([solana]),
    id: wallet.adapter.name,
    isSolanaConnector: true,
    name: wallet.adapter.name,
    rkDetails: {
      groupName: "Solana",
      installed:
        wallet.readyState === WalletReadyState.Installed ||
        wallet.readyState === WalletReadyState.Loadable,
    },
    solanaAdapter: wallet.adapter,
    solanaAdapterSource: wallet.source,
    type: `solana-${wallet.source}`,
    connect: async (parameters) =>
      ({
        accounts: parameters?.withCapabilities
          ? [{ address: solanaAccount, capabilities: {} }]
          : [solanaAccount],
        chainId: solana.id,
      }) as never,
    disconnect: async () => undefined,
    getAccounts: async () => [solanaAccount],
    getChainId: async () => solana.id,
    getProvider: async () => ({}),
    isAuthorized: async () => false,
    onAccountsChanged: () => undefined,
    onChainChanged: () => undefined,
    onDisconnect: () => config.emitter.emit("disconnect"),
    sendTransaction: async () => "signature",
  }));

const makeSolanaRuntime = (initial: SolanaWalletSnapshot) => {
  const listeners = new Set<() => Promise<void> | void>();
  let snapshot = initial;
  const runtime = {
    connection: {} as Connection,
    current: Effect.sync(() => snapshot),
    states: Stream.callback<SolanaWalletSnapshot>((queue) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          const listener = () => {
            Queue.offerUnsafe(queue, snapshot);
          };
          listeners.add(listener);
          listener();
          return listener;
        }),
        (listener) => Effect.sync(() => listeners.delete(listener))
      )
    ),
  } satisfies SolanaRuntime;

  return {
    emit: async (next: SolanaWalletSnapshot) => {
      snapshot = next;
      await Promise.all([...listeners].map((listener) => listener()));
    },
    listenerCount: () => listeners.size,
    runtime,
  };
};

const ControllerHarness = ({
  forceWalletConnectOnly,
  onConfig,
}: {
  readonly forceWalletConnectOnly: boolean;
  readonly onConfig: (config: Config) => void;
}) => (
  <ThirdPartyQueryClientProvider>
    <StrictMode>
      <TestAtomRuntimeProvider
        settings={getTestWidgetConfig({
          apiKey: import.meta.env.VITE_API_KEY,
          disableInjectedProviderDiscovery: true,
          forceWalletConnectOnly,
          variant: "default",
        })}
      >
        <WagmiConfigProvider>
          <ConfigObserver onConfig={onConfig} />
        </WagmiConfigProvider>
      </TestAtomRuntimeProvider>
    </StrictMode>
  </ThirdPartyQueryClientProvider>
);

describe("WagmiConfigProvider", () => {
  it("shares and finalizes the Connector Source across every runtime", async ({
    worker,
  }) => {
    worker.use(
      http.get(yieldApiRoute("/v1/networks"), () =>
        HttpResponse.json([{ id: "ethereum" }])
      )
    );
    let initialized = 0;
    let disposed = 0;
    const walletListFactory = rkMockWallet({
      accounts: ["0x0000000000000000000000000000000000000001"],
    });
    const connectorSourceLayer = Layer.effect(
      WalletConnectorSource,
      Effect.acquireRelease(
        Effect.sync(() => {
          initialized += 1;
          return WalletConnectorSource.of({ walletListFactory });
        }),
        () =>
          Effect.sync(() => {
            disposed += 1;
          })
      )
    );
    const onSources = vi.fn();
    const app = await render(
      <ThirdPartyQueryClientProvider>
        <TestAtomRuntimeProvider
          initialValues={[
            [walletConnectorSourceRuntime.layer, connectorSourceLayer],
          ]}
          settings={getTestWidgetConfig({
            apiKey: import.meta.env.VITE_API_KEY,
            disableInjectedProviderDiscovery: true,
            variant: "default",
          })}
        >
          <WagmiConfigProvider>
            <RuntimeConnectorSourceObserver onSources={onSources} />
          </WagmiConfigProvider>
        </TestAtomRuntimeProvider>
      </ThirdPartyQueryClientProvider>
    );

    await vi.waitFor(() => expect(onSources).toHaveBeenCalled());
    const sources = onSources.mock.lastCall?.[0];
    if (!sources) throw new Error("Expected runtime Connector Sources");

    expect(sources[1]).toBe(sources[0]);
    expect(sources[2]).toBe(sources[0]);
    expect(initialized).toBe(1);

    await app.unmount();
    await expect.poll(() => disposed).toBe(1);
  });

  it("publishes dynamic Solana membership and same-uid readiness through useConnectors", async () => {
    const fallbackAdapter = makeSolanaAdapter("Phantom");
    const standardAdapter = makeSolanaAdapter("Phantom");
    const fallback = makeSolanaDescriptor(
      fallbackAdapter,
      "fallback",
      WalletReadyState.NotDetected
    );
    const standard = makeSolanaDescriptor(
      standardAdapter,
      "standard",
      WalletReadyState.NotDetected
    );
    const readyStandard = makeSolanaDescriptor(
      standardAdapter,
      "standard",
      WalletReadyState.Loadable
    );
    const runtime = makeSolanaRuntime({ wallets: [fallback] });
    const config = createConfig({
      chains: [solana],
      connectors: [makeSolanaConnectorFactory(fallback)],
      transports: { [solana.id]: wagmiHttp() },
    });
    const coreSnapshots: ReadonlyArray<unknown>[] = [];
    const unsubscribeCore = watchConnectors(config, {
      onChange: (connectors) => coreSnapshots.push(connectors),
    });

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* installSolanaConnectorMembership({
            actions: { disconnect: () => Effect.void },
            config,
            core: {
              current: Effect.succeed({
                connection: {} as never,
                connectors: config.connectors,
              }),
              states: Stream.concat(
                Stream.succeed({
                  connection: {} as never,
                  connectors: config.connectors,
                }),
                Stream.never
              ),
            },
            createConnector: (wallet) =>
              Effect.succeed(makeSolanaConnectorFactory(wallet)),
            runtime: runtime.runtime,
          });
          yield* Effect.promise(() =>
            expect.poll(() => runtime.listenerCount()).toBe(1)
          );
          const configIdentity = config;
          const hook = yield* Effect.promise(() =>
            renderHook(() => useConnectors(), {
              wrapper: ({ children }) => (
                <WagmiContext.Provider value={config}>
                  {children}
                </WagmiContext.Provider>
              ),
            })
          );

          yield* Effect.promise(() =>
            hook.act(() => runtime.emit({ wallets: [standard] }))
          );
          yield* Effect.promise(() =>
            expect
              .poll(() => hook.result.current[0]?.solanaAdapterSource)
              .toBe("standard")
          );
          const standardConnector = hook.result.current[0]!;
          expect(standardConnector).toMatchObject({
            rkDetails: { installed: false },
            solanaAdapter: standardAdapter,
          });

          yield* Effect.promise(() =>
            hook.act(() => runtime.emit({ wallets: [readyStandard] }))
          );
          yield* Effect.promise(() =>
            expect
              .poll(() => {
                const connector = hook.result.current[0];
                return connector && "rkDetails" in connector
                  ? (connector.rkDetails as { readonly installed: boolean })
                      .installed
                  : false;
              })
              .toBe(true)
          );
          const readyConnector = hook.result.current[0]!;
          expect(readyConnector).not.toBe(standardConnector);
          expect(readyConnector.uid).toBe(standardConnector.uid);
          expect(readyConnector.emitter).toBe(standardConnector.emitter);
          expect(readyConnector).toMatchObject({
            rkDetails: { installed: true },
            solanaAdapter: standardAdapter,
          });
          expect(config).toBe(configIdentity);
        })
      )
    );

    unsubscribeCore();
    expect(coreSnapshots).toHaveLength(2);
    expect(coreSnapshots.at(-1)?.[0]).toMatchObject({
      rkDetails: { installed: true },
      uid: config.connectors[0]?.uid,
    });
  });

  it("stops providing the fallback when wallet bootstrap fails", async () => {
    const cause = new Error("wallet bootstrap failed");
    const onError = vi.fn<(error: unknown) => void>();
    const app = await render(
      <RegistryProvider
        initialValues={[
          [
            walletRuntime.layer,
            Layer.effect(WalletService, Effect.fail(cause)) as never,
          ],
        ]}
      >
        <RuntimeErrorBoundary onError={onError}>
          <WagmiConfigProvider>
            <div>provider ready</div>
          </WagmiConfigProvider>
        </RuntimeErrorBoundary>
      </RegistryProvider>
    );

    await expect.element(app.getByText("runtime failed")).toBeVisible();
    expect(onError).toHaveBeenCalledWith(cause);
  });

  it("uses the fallback only while loading, then provides the initialized config by reference", async ({
    worker,
  }) => {
    worker.use(
      http.get(yieldApiRoute("/v1/networks"), async () => {
        await mockDelay();
        return HttpResponse.json([{ id: "ethereum" }]);
      })
    );

    const hook = await renderHook(useWagmiProviderContract, {
      wrapper: ({ children }) => (
        <ThirdPartyQueryClientProvider>
          <StrictMode>
            <TestAtomRuntimeProvider
              settings={getTestWidgetConfig({
                apiKey: import.meta.env.VITE_API_KEY,
                disableInjectedProviderDiscovery: true,
                variant: "default",
              })}
            >
              <WagmiConfigProvider>{children}</WagmiConfigProvider>
            </TestAtomRuntimeProvider>
          </StrictMode>
        </ThirdPartyQueryClientProvider>
      ),
    });

    const fallbackConfig = hook.result.current.contextConfig;
    expect(fallbackConfig).toBeDefined();
    expect(AsyncResult.isInitial(hook.result.current.walletConfig)).toBe(true);

    await expect
      .poll(
        () => ({
          data: Option.isSome(
            AsyncResult.value(hook.result.current.walletConfig)
          ),
          error: hook.result.current.walletConfig.pipe(
            AsyncResult.error,
            Option.getOrUndefined
          ),
        }),
        { timeout: 10_000 }
      )
      .toEqual({ data: true, error: undefined });

    expect(hook.result.current.contextConfig).toBe(
      hook.result.current.walletConfig.pipe(
        AsyncResult.value,
        Option.getOrUndefined
      )
    );
    expect(hook.result.current.contextConfig).not.toBe(fallbackConfig);
  });

  it("keeps the authoritative config across StrictMode rerenders", async ({
    worker,
  }) => {
    worker.use(
      http.get(yieldApiRoute("/v1/networks"), () =>
        HttpResponse.json([{ id: "ethereum" }])
      )
    );
    const onConfig = vi.fn<(config: Config) => void>();
    const renderHarness = (forceWalletConnectOnly: boolean) => (
      <ControllerHarness
        forceWalletConnectOnly={forceWalletConnectOnly}
        onConfig={onConfig}
      />
    );
    const app = await render(renderHarness(false));

    await vi.waitFor(() => {
      expect(onConfig).toHaveBeenCalled();
    });
    const firstConfig = onConfig.mock.lastCall?.[0];
    expect(firstConfig).toBeDefined();
    onConfig.mockClear();

    await app.rerender(renderHarness(false));
    expect(onConfig).not.toHaveBeenCalled();
  });

  it("keeps RainbowKit-facing actions on the authoritative config", async ({
    worker,
  }) => {
    worker.use(
      http.get(yieldApiRoute("/v1/networks"), () =>
        HttpResponse.json([{ id: "ethereum" }, { id: "optimism" }])
      )
    );
    const account = "0x0000000000000000000000000000000000000001";
    const hook = await renderHook(useRainbowKitWagmiContract, {
      wrapper: ({ children }) => (
        <ThirdPartyQueryClientProvider>
          <TestAtomRuntimeProvider
            initialValues={[
              [
                walletConnectorSourceRuntime.layer,
                WalletConnectorSource.layer(
                  rkMockWallet({ accounts: [account] })
                ),
              ],
            ]}
            settings={getTestWidgetConfig({
              apiKey: import.meta.env.VITE_API_KEY,
              disableInjectedProviderDiscovery: true,
              variant: "default",
            })}
          >
            <WagmiConfigProvider>{children}</WagmiConfigProvider>
          </TestAtomRuntimeProvider>
        </ThirdPartyQueryClientProvider>
      ),
    });
    const initialConfig = hook.result.current.contextConfig;

    expect(initialConfig).toBeDefined();

    await expect
      .poll(
        () => ({
          connected: hook.result.current.account.isConnected,
          ready: Option.isSome(
            AsyncResult.value(hook.result.current.walletConfig)
          ),
        }),
        { timeout: 10_000 }
      )
      .toEqual({ connected: true, ready: true });
    const walletConfig = hook.result.current.walletConfig.pipe(
      AsyncResult.value,
      Option.getOrUndefined
    );
    if (initialConfig !== walletConfig) {
      expect(initialConfig?.state.connections.size).toBe(0);
    }
    expect(hook.result.current.contextConfig).toBe(walletConfig);
    expect(
      AsyncResult.getOrThrow(hook.result.current.walletProjection)
    ).toMatchObject({ address: account, status: "connected" });

    await hook.result.current.disconnect.disconnectAsync();
    await expect
      .poll(() => ({
        account: hook.result.current.account.status,
        projection: AsyncResult.getOrThrow(hook.result.current.walletProjection)
          .status,
      }))
      .toEqual({ account: "disconnected", projection: "disconnected" });

    await hook.result.current.connect.connectAsync({
      connector: EArray.getUnsafe(hook.result.current.connectors, 0),
    });
    await expect
      .poll(() => ({
        account: hook.result.current.account.status,
        projection: AsyncResult.getOrThrow(hook.result.current.walletProjection)
          .status,
      }))
      .toEqual({ account: "connected", projection: "connected" });

    await hook.result.current.switchChain.switchChainAsync({
      chainId: optimism.id,
    });
    await expect
      .poll(() => ({
        account: hook.result.current.account.chainId,
        projection: AsyncResult.getOrThrow(hook.result.current.walletProjection)
          .chain?.id,
      }))
      .toEqual({ account: optimism.id, projection: optimism.id });
  });

  it("keeps providing the fallback after a geo-blocked wallet bootstrap", async () => {
    const blocked = {
      countryCode: "AT",
      regionCode: "AT-9",
      tags: new Set<string>(),
    };
    const geoBlock = GeoBlockService.of({
      observeResponse: () => Effect.void,
      states: Stream.succeed(blocked),
    });

    const app = await render(
      <RegistryProvider
        initialValues={[
          [appRuntime.layer, Layer.succeed(GeoBlockService, geoBlock) as never],
          [
            walletRuntime.layer,
            Layer.effect(
              WalletService,
              Effect.fail(new Error("geo-blocked wallet bootstrap"))
            ) as never,
          ],
        ]}
      >
        <WagmiConfigProvider>
          <div>geo-block fallback ready</div>
        </WagmiConfigProvider>
      </RegistryProvider>
    );

    await expect
      .element(app.getByText("geo-block fallback ready"))
      .toBeVisible();
  });
});
