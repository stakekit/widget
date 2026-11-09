import { RegistryProvider, useAtomValue } from "@effect/atom-react";
import { Cause, Array as EArray, Effect, Layer, Option, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { HttpResponse, http } from "msw";
import {
  Component,
  type PropsWithChildren,
  StrictMode,
  useContext,
  useEffect,
} from "react";
import { type Config, useAccount, useConnectors, WagmiContext } from "wagmi";
import { connect, disconnect, switchChain } from "wagmi/actions";
import { optimism } from "wagmi/chains";

import { WagmiConfigProvider } from "../../../src/features/wallet/composition";
import {
  walletConfigResultAtom,
  walletStateResultAtom,
} from "../../../src/features/wallet/index";
import { appRuntime } from "../../../src/runtime/app-runtime";
import { applicationBaseRuntime } from "../../../src/runtime/application-base-runtime";
import { walletConnectorSourceRuntime } from "../../../src/runtime/wallet-connector-source-runtime";
import { walletRuntime } from "../../../src/runtime/wallet-runtime";
import { GeoBlockService } from "../../../src/services/geoblocking";
import { WalletConnectorSource } from "../../../src/services/wallet/wallet-connector-source";
import { WalletService } from "../../../src/services/wallet/wallet-service";
import { yieldApiRoute } from "../../mocks/api-routes";
import { mockDelay } from "../../mocks/delay";
import { TestAtomRuntimeProvider } from "../../utils/atom-runtime-provider";
import { mockWalletListFactory } from "../../utils/mock-connector";
import { describe, expect, it, vi } from "../../utils/test-extend.dom.ts";
import { render, renderHook } from "../../utils/test-utils.dom.tsx";

const baseConnectorSourceProbeAtom = applicationBaseRuntime.atom(
  Effect.service(WalletConnectorSource)
);
const appConnectorSourceProbeAtom = appRuntime.atom(
  Effect.service(WalletConnectorSource)
);
const walletConnectorSourceProbeAtom = walletRuntime.atom(
  Effect.service(WalletConnectorSource)
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
  walletConfig: useAtomValue(walletConfigResultAtom),
});

const ConfigObserver = ({
  onConfig,
}: {
  readonly onConfig: (config: Config) => void;
}) => {
  const walletConfig = useAtomValue(walletConfigResultAtom);
  const config = walletConfig.pipe(AsyncResult.value, Option.getOrUndefined);

  useEffect(() => {
    if (config) onConfig(config);
  });

  return null;
};

const useWagmiContract = () => ({
  account: useAccount(),
  connectors: useConnectors(),
  contextConfig: useContext(WagmiContext) as Config | undefined,
  walletConfig: useAtomValue(walletConfigResultAtom),
  walletProjection: useAtomValue(walletStateResultAtom),
});

const ControllerHarness = ({
  onConfig,
}: {
  readonly onConfig: (config: Config) => void;
}) => (
  <StrictMode>
    <TestAtomRuntimeProvider
      hostConfiguration={{
        apiKey: import.meta.env.VITE_API_KEY,
        disableInjectedProviderDiscovery: true,
        variant: "default",
      }}
    >
      <WagmiConfigProvider>
        <ConfigObserver onConfig={onConfig} />
      </WagmiConfigProvider>
    </TestAtomRuntimeProvider>
  </StrictMode>
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
    const walletListFactory = mockWalletListFactory({
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
      <TestAtomRuntimeProvider
        initialValues={[
          [walletConnectorSourceRuntime.layer, connectorSourceLayer],
        ]}
        hostConfiguration={{
          apiKey: import.meta.env.VITE_API_KEY,
          disableInjectedProviderDiscovery: true,
          variant: "default",
        }}
      >
        <WagmiConfigProvider>
          <RuntimeConnectorSourceObserver onSources={onSources} />
        </WagmiConfigProvider>
      </TestAtomRuntimeProvider>
    );

    await vi.waitFor(() => expect(onSources).toHaveBeenCalled());
    const sources = onSources.mock.lastCall?.[0];
    if (!sources) throw new Error("Expected runtime Connector Sources");

    expect(sources[1]).toBe(sources[0]);
    expect(sources[2]).toBe(sources[0]);
    expect(initialized).toBe(1);

    app.unmount();
    await expect.poll(() => disposed).toBe(1);
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

    await vi.waitFor(() =>
      expect(app.container.textContent).toBe("runtime failed")
    );
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
        <StrictMode>
          <TestAtomRuntimeProvider
            hostConfiguration={{
              apiKey: import.meta.env.VITE_API_KEY,
              disableInjectedProviderDiscovery: true,
              variant: "default",
            }}
          >
            <WagmiConfigProvider>{children}</WagmiConfigProvider>
          </TestAtomRuntimeProvider>
        </StrictMode>
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
    const renderHarness = () => <ControllerHarness onConfig={onConfig} />;
    const app = await render(renderHarness());

    await vi.waitFor(() => {
      expect(onConfig).toHaveBeenCalled();
    });
    const firstConfig = onConfig.mock.lastCall?.[0];
    expect(firstConfig).toBeDefined();
    onConfig.mockClear();

    await app.rerender(renderHarness());
    expect(onConfig).not.toHaveBeenCalled();
  });

  it("keeps wallet actions on the authoritative config", async ({ worker }) => {
    worker.use(
      http.get(yieldApiRoute("/v1/networks"), () =>
        HttpResponse.json([{ id: "ethereum" }, { id: "optimism" }])
      )
    );
    const account = "0x0000000000000000000000000000000000000001";
    const hook = await renderHook(useWagmiContract, {
      wrapper: ({ children }) => (
        <TestAtomRuntimeProvider
          initialValues={[
            [
              walletConnectorSourceRuntime.layer,
              WalletConnectorSource.layer(
                mockWalletListFactory({ accounts: [account] })
              ),
            ],
          ]}
          hostConfiguration={{
            apiKey: import.meta.env.VITE_API_KEY,
            disableInjectedProviderDiscovery: true,
            variant: "default",
          }}
        >
          <WagmiConfigProvider>{children}</WagmiConfigProvider>
        </TestAtomRuntimeProvider>
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
    if (!walletConfig) throw new Error("Wallet config was not ready");
    expect(
      AsyncResult.getOrThrow(hook.result.current.walletProjection)
    ).toMatchObject({ address: account, status: "connected" });

    await disconnect(walletConfig);
    await expect
      .poll(() => ({
        account: hook.result.current.account.status,
        projection: AsyncResult.getOrThrow(hook.result.current.walletProjection)
          .status,
      }))
      .toEqual({ account: "disconnected", projection: "disconnected" });

    await connect(walletConfig, {
      connector: EArray.getUnsafe(hook.result.current.connectors, 0),
    });
    await expect
      .poll(() => ({
        account: hook.result.current.account.status,
        projection: AsyncResult.getOrThrow(hook.result.current.walletProjection)
          .status,
      }))
      .toEqual({ account: "connected", projection: "connected" });

    await switchChain(walletConfig, { chainId: optimism.id });
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
              Effect.fail(
                new Cause.UnknownError("geo-blocked wallet bootstrap")
              )
            ) as never,
          ],
        ]}
      >
        <WagmiConfigProvider>
          <div>geo-block fallback ready</div>
        </WagmiConfigProvider>
      </RegistryProvider>
    );

    await vi.waitFor(() =>
      expect(app.container.textContent).toBe("geo-block fallback ready")
    );
  });
});
