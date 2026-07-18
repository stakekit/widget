import { RegistryProvider, useAtomValue } from "@effect/atom-react";
import {
  type Adapter,
  type WalletName,
  WalletReadyState,
} from "@solana/wallet-adapter-base";
import type { Connection } from "@solana/web3.js";
import { Array as EArray, Effect, Layer, Stream } from "effect";
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
import { normalizeWidgetConfig } from "../../src/app/config";
import { appRuntime } from "../../src/app/runtime";
import { solana } from "../../src/domain/types/chains/misc";
import { EvmNetworks } from "../../src/domain/types/chains/networks";
import {
  currentWalletConnectionResultAtom,
  currentWalletConnectorsResultAtom,
  useWalletController,
} from "../../src/features/wallet";
import { WagmiConfigProvider } from "../../src/features/wallet/react/provider";
import {
  bootstrappingWalletRuntimeSnapshot,
  type WalletRuntimeSnapshot,
} from "../../src/services/wallet/domain/runtime";
import { installSolanaConnectorMembership } from "../../src/services/wallet/solana-connector-membership";
import type {
  HeadlessSolanaRuntime,
  SolanaWalletDescriptor,
  SolanaWalletSnapshot,
} from "../../src/services/wallet/solana-runtime";
import { WalletService } from "../../src/services/wallet/wallet-service";
import { makeCurrentValueStream } from "../../src/shared/effect/current-value-stream";
import { legacyApiRoute } from "../mocks/api-routes";
import { mockDelay } from "../mocks/delay";
import { TestAtomRuntimeProvider } from "../utils/atom-runtime-provider";
import { rkMockWallet } from "../utils/mock-connector";
import { describe, expect, it, vi } from "../utils/test-extend";
import { render, renderHook } from "../utils/test-utils";

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
  initializedConfig: useWalletController(),
});

const ConfigObserver = ({
  onConfig,
}: {
  readonly onConfig: (config: Config) => void;
}) => {
  const controller = useWalletController();

  useEffect(() => {
    if (controller.data) onConfig(controller.data.wagmiConfig);
  });

  return null;
};

const useRainbowKitWagmiContract = () => ({
  account: useAccount(),
  connect: useConnect(),
  connectionProjection: useAtomValue(currentWalletConnectionResultAtom),
  connectors: useConnectors(),
  connectorsProjection: useAtomValue(currentWalletConnectorsResultAtom),
  contextConfig: useContext(WagmiContext) as Config | undefined,
  controller: useWalletController(),
  disconnect: useDisconnect(),
  switchChain: useSwitchChain(),
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
    getWalletSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  } satisfies HeadlessSolanaRuntime;

  return {
    emit: async (next: SolanaWalletSnapshot) => {
      snapshot = next;
      await Promise.all([...listeners].map((listener) => listener()));
    },
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
        settings={normalizeWidgetConfig({
          apiKey: import.meta.env.VITE_API_KEY,
          disableInjectedProviderDiscovery: true,
          variant: "default",
          wagmi: { forceWalletConnectOnly },
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
            config,
            createConnector: async (wallet) =>
              makeSolanaConnectorFactory(wallet),
            runtime: runtime.runtime,
          });
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
          const standardConnector = hook.result.current[0]!;
          expect(standardConnector).toMatchObject({
            rkDetails: { installed: false },
            solanaAdapter: standardAdapter,
          });

          yield* Effect.promise(() =>
            hook.act(() => runtime.emit({ wallets: [readyStandard] }))
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
    const source = makeCurrentValueStream<WalletRuntimeSnapshot>(
      bootstrappingWalletRuntimeSnapshot
    );
    const app = await render(
      <RegistryProvider
        initialValues={[
          [
            appRuntime.layer,
            Layer.succeed(WalletService, {
              changes: source.changes,
              legacyController: Effect.succeed(null),
            } as never) as never,
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

    await expect.element(app.getByText("provider ready")).toBeVisible();
    source.set({
      cause,
      phase: "BootstrapFailed",
      projection: null,
      wagmiConfig: null,
    });

    await expect.element(app.getByText("runtime failed")).toBeVisible();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        _tag: "WalletRuntimeTerminalError",
        cause,
        phase: "BootstrapFailed",
      })
    );
  });

  it("uses the fallback only while loading, then provides the initialized config by reference", async ({
    worker,
  }) => {
    worker.use(
      http.get(legacyApiRoute("/v1/yields/enabled/networks"), async () => {
        await mockDelay();
        return HttpResponse.json([EvmNetworks.Ethereum]);
      })
    );

    const hook = await renderHook(useWagmiProviderContract, {
      wrapper: ({ children }) => (
        <ThirdPartyQueryClientProvider>
          <StrictMode>
            <TestAtomRuntimeProvider
              settings={normalizeWidgetConfig({
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
    expect(hook.result.current.initializedConfig.isLoading).toBe(true);

    await expect
      .poll(
        () => ({
          data: Boolean(hook.result.current.initializedConfig.data),
          error: hook.result.current.initializedConfig.error,
        }),
        { timeout: 10_000 }
      )
      .toEqual({ data: true, error: undefined });

    expect(hook.result.current.contextConfig).toBe(
      hook.result.current.initializedConfig.data?.wagmiConfig
    );
    expect(hook.result.current.contextConfig).not.toBe(fallbackConfig);
  });

  it("keeps the authoritative config across StrictMode and wallet-setting rerenders", async ({
    worker,
  }) => {
    worker.use(
      http.get(legacyApiRoute("/v1/yields/enabled/networks"), () =>
        HttpResponse.json([EvmNetworks.Ethereum])
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

    await app.rerender(renderHarness(true));
    await vi.waitFor(() => expect(onConfig).toHaveBeenCalled());
    expect(onConfig.mock.lastCall?.[0]).toBe(firstConfig);
  });

  it("keeps RainbowKit-facing actions on the authoritative config", async ({
    worker,
  }) => {
    worker.use(
      http.get(legacyApiRoute("/v1/yields/enabled/networks"), () =>
        HttpResponse.json([EvmNetworks.Ethereum, EvmNetworks.Optimism])
      )
    );
    const account = "0x0000000000000000000000000000000000000001";
    const hook = await renderHook(useRainbowKitWagmiContract, {
      wrapper: ({ children }) => (
        <ThirdPartyQueryClientProvider>
          <TestAtomRuntimeProvider
            settings={normalizeWidgetConfig({
              apiKey: import.meta.env.VITE_API_KEY,
              disableInjectedProviderDiscovery: true,
              variant: "default",
              wagmi: {
                __customConnectors__: rkMockWallet({ accounts: [account] }),
              },
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
          ready: Boolean(hook.result.current.controller.data),
        }),
        { timeout: 10_000 }
      )
      .toEqual({ connected: true, ready: true });
    if (initialConfig !== hook.result.current.controller.data?.wagmiConfig) {
      expect(initialConfig?.state.connections.size).toBe(0);
    }
    expect(hook.result.current.contextConfig).toBe(
      hook.result.current.controller.data?.wagmiConfig
    );
    expect(
      AsyncResult.getOrThrow(hook.result.current.connectionProjection)
    ).toMatchObject({ address: account, status: "connected" });
    expect(
      AsyncResult.getOrThrow(hook.result.current.connectorsProjection).map(
        (connector) => connector.uid
      )
    ).toEqual(hook.result.current.connectors.map((connector) => connector.uid));

    await hook.result.current.disconnect.disconnectAsync();
    await expect
      .poll(() => ({
        account: hook.result.current.account.status,
        projection: AsyncResult.getOrThrow(
          hook.result.current.connectionProjection
        ).status,
      }))
      .toEqual({ account: "disconnected", projection: "disconnected" });

    await hook.result.current.connect.connectAsync({
      connector: EArray.getUnsafe(hook.result.current.connectors, 0),
    });
    await expect
      .poll(() => ({
        account: hook.result.current.account.status,
        projection: AsyncResult.getOrThrow(
          hook.result.current.connectionProjection
        ).status,
      }))
      .toEqual({ account: "connected", projection: "connected" });

    await hook.result.current.switchChain.switchChainAsync({
      chainId: optimism.id,
    });
    await expect
      .poll(() => ({
        account: hook.result.current.account.chainId,
        projection: AsyncResult.getOrThrow(
          hook.result.current.connectionProjection
        ).chainId,
      }))
      .toEqual({ account: optimism.id, projection: optimism.id });
  });
});
