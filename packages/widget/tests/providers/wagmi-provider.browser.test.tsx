import { Array as EArray } from "effect";
import { HttpResponse, http } from "msw";
import { StrictMode, useContext, useEffect } from "react";
import type { Config } from "wagmi";
import {
  useAccount,
  useConnect,
  useConnectors,
  useDisconnect,
  useSwitchChain,
  WagmiContext,
} from "wagmi";
import { optimism } from "wagmi/chains";
import { ThirdPartyQueryClientProvider } from "../../src/app/composition/providers/query-client";
import { SolanaProvider } from "../../src/app/composition/providers/solana";
import { normalizeWidgetConfig } from "../../src/app/config";
import { EvmNetworks } from "../../src/domain/types/chains/networks";
import { useWalletController } from "../../src/features/wallet";
import { WagmiConfigProvider } from "../../src/features/wallet/react/provider";
import { legacyApiRoute } from "../mocks/api-routes";
import { mockDelay } from "../mocks/delay";
import { TestAtomRuntimeProvider } from "../utils/atom-runtime-provider";
import { rkMockWallet } from "../utils/mock-connector";
import { describe, expect, it, vi } from "../utils/test-extend";
import { render, renderHook } from "../utils/test-utils.dom";

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
  }, [controller.data, onConfig]);

  return null;
};

const useRainbowKitWagmiContract = () => ({
  account: useAccount(),
  connect: useConnect(),
  connectors: useConnectors(),
  contextConfig: useContext(WagmiContext) as Config | undefined,
  controller: useWalletController(),
  disconnect: useDisconnect(),
  switchChain: useSwitchChain(),
});

const ControllerHarness = ({
  forceWalletConnectOnly,
  onConfig,
}: {
  readonly forceWalletConnectOnly: boolean;
  readonly onConfig: (config: Config) => void;
}) => (
  <ThirdPartyQueryClientProvider>
    <SolanaProvider>
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
    </SolanaProvider>
  </ThirdPartyQueryClientProvider>
);

describe("WagmiConfigProvider", () => {
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
          <SolanaProvider>
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
          </SolanaProvider>
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

  it("deduplicates equivalent StrictMode rerenders and replaces static topology", async ({
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
    await vi.waitFor(() => {
      expect(onConfig.mock.lastCall?.[0]).not.toBe(firstConfig);
    });
  });

  it("keeps RainbowKit-facing actions on the authoritative config without fallback leakage", async ({
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
          <SolanaProvider>
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
          </SolanaProvider>
        </ThirdPartyQueryClientProvider>
      ),
    });
    const fallbackConfig = hook.result.current.contextConfig;
    const fallbackState = fallbackConfig?.state;

    expect(fallbackConfig).toBeDefined();
    expect(fallbackState?.connections.size).toBe(0);

    await expect
      .poll(
        () => ({
          connected: hook.result.current.account.isConnected,
          ready: Boolean(hook.result.current.controller.data),
        }),
        { timeout: 10_000 }
      )
      .toEqual({ connected: true, ready: true });
    expect(hook.result.current.contextConfig).toBe(
      hook.result.current.controller.data?.wagmiConfig
    );

    await hook.result.current.disconnect.disconnectAsync();
    await expect
      .poll(() => hook.result.current.account.isDisconnected)
      .toBe(true);

    await hook.result.current.connect.connectAsync({
      connector: EArray.getUnsafe(hook.result.current.connectors, 0),
    });
    await expect.poll(() => hook.result.current.account.isConnected).toBe(true);

    await hook.result.current.switchChain.switchChainAsync({
      chainId: optimism.id,
    });
    await expect
      .poll(() => hook.result.current.account.chainId)
      .toBe(optimism.id);

    expect(fallbackConfig?.state).toBe(fallbackState);
    expect(fallbackConfig?.state.connections.size).toBe(0);
  });
});
