import { useAtomSubscribe, useAtomValue } from "@effect/atom-react";
import { useLayoutEffect } from "react";
import { mainnet, optimism } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import { SolanaProvider } from "../../src/app/composition/providers/solana";
import {
  normalizeWidgetConfig,
  widgetBootstrapConfigAtom,
  widgetConfigAtom,
} from "../../src/app/config";
import {
  dynamicExternalProviderInputAtom,
  solanaWalletInputAtom,
} from "../../src/app/runtime/root-inputs";
import type { SKExternalProviders } from "../../src/public-api/types";
import { TestAtomRuntimeProvider } from "../utils/atom-runtime-provider";
import { render, renderHook } from "../utils/test-utils.dom";

const useRootInputs = () => ({
  bootstrap: useAtomValue(widgetBootstrapConfigAtom),
  dynamicWallet: useAtomValue(dynamicExternalProviderInputAtom),
  solana: useAtomValue(solanaWalletInputAtom),
});

type RootInputs = ReturnType<typeof useRootInputs>;

const RootInputObserver = ({
  onValue,
}: {
  readonly onValue: (value: RootInputs) => void;
}) => {
  const value = useRootInputs();

  useLayoutEffect(() => {
    onValue(value);
  }, [onValue, value]);

  return null;
};

const RootInputHarness = ({
  apiKey,
  disableInjectedProviderDiscovery,
  externalProviders,
  onValue,
}: {
  readonly apiKey: string;
  readonly disableInjectedProviderDiscovery?: boolean;
  readonly externalProviders: SKExternalProviders;
  readonly onValue: (value: RootInputs) => void;
}) => (
  <SolanaProvider>
    <TestAtomRuntimeProvider
      settings={normalizeWidgetConfig({
        apiKey,
        disableInjectedProviderDiscovery,
        externalProviders,
        variant: "default",
      })}
    >
      <RootInputObserver onValue={onValue} />
    </TestAtomRuntimeProvider>
  </SolanaProvider>
);

const RootInputPublicationObserver = ({
  onConfig,
  onDynamicWallet,
}: {
  readonly onConfig: () => void;
  readonly onDynamicWallet: () => void;
}) => {
  useAtomSubscribe(widgetConfigAtom, onConfig);
  useAtomSubscribe(dynamicExternalProviderInputAtom, onDynamicWallet);

  return null;
};

const makeExternalProvider = (
  overrides: Partial<SKExternalProviders> = {}
): SKExternalProviders => ({
  currentAddress: "0x0000000000000000000000000000000000000001",
  currentChain: mainnet.id,
  initToken: "ethereum-eth",
  provider: {
    sendTransaction: vi.fn(async () => "first-hash"),
    signMessage: vi.fn(async () => "first-signature"),
    switchChain: vi.fn(async () => undefined),
  },
  supportedChainIds: [mainnet.id],
  type: "generic",
  ...overrides,
});

describe("TestAtomRuntimeProvider root inputs", () => {
  it("seeds immutable bootstrap and React-owned live inputs", async () => {
    const provider = makeExternalProvider({
      currentChain: optimism.id,
      supportedChainIds: [optimism.id, mainnet.id, optimism.id],
    });
    const hook = await renderHook(useRootInputs, {
      wrapper: ({ children }) => (
        <SolanaProvider>
          <TestAtomRuntimeProvider
            settings={normalizeWidgetConfig({
              apiKey: "api-key",
              baseUrl: "https://legacy.example.com",
              borrowApiUrl: "https://borrow.example.com",
              disableInjectedProviderDiscovery: true,
              externalProviders: provider,
              variant: "default",
              yieldsApiUrl: "https://yields.example.com",
            })}
          >
            {children}
          </TestAtomRuntimeProvider>
        </SolanaProvider>
      ),
    });

    expect(hook.result.current.bootstrap.api).toEqual({
      apiKey: "api-key",
      baseUrl: "https://legacy.example.com",
      borrowApiUrl: "https://borrow.example.com",
      yieldsApiUrl: "https://yields.example.com",
    });
    expect(hook.result.current.bootstrap.wallet).toMatchObject({
      disableInjectedProviderDiscovery: true,
      externalProviderInitToken: "ethereum-eth",
      hasExternalProvider: true,
      variant: "default",
    });
    expect(hook.result.current.dynamicWallet).toMatchObject({
      currentAddress: provider.currentAddress,
      currentChain: optimism.id,
      provider: provider.provider,
      supportedChainIds: [mainnet.id, optimism.id],
    });
    expect(hook.result.current.solana.connection).not.toBeNull();
    expect(hook.result.current.solana.wallets).toEqual([]);
  });

  it("synchronizes configuration and external-provider live state", async () => {
    const firstProvider = makeExternalProvider();
    const replacementProvider = makeExternalProvider({
      currentAddress: "0x0000000000000000000000000000000000000002",
      currentChain: optimism.id,
      provider: {
        sendTransaction: vi.fn(async () => "replacement-hash"),
        signMessage: vi.fn(async () => "replacement-signature"),
        switchChain: vi.fn(async () => undefined),
      },
      supportedChainIds: [optimism.id],
    });
    const onValue = vi.fn<(value: RootInputs) => void>();
    const app = await render(
      <RootInputHarness
        apiKey="first-key"
        externalProviders={firstProvider}
        onValue={onValue}
      />
    );

    await vi.waitFor(() => {
      expect(onValue.mock.lastCall?.[0].bootstrap.api.apiKey).toBe("first-key");
    });

    await app.rerender(
      <RootInputHarness
        apiKey="replacement-key"
        disableInjectedProviderDiscovery
        externalProviders={replacementProvider}
        onValue={onValue}
      />
    );

    await vi.waitFor(() => {
      const value = onValue.mock.lastCall?.[0];
      expect(value?.dynamicWallet).toMatchObject({
        currentAddress: replacementProvider.currentAddress,
        currentChain: replacementProvider.currentChain,
        provider: replacementProvider.provider,
      });
    });
    expect(onValue.mock.lastCall?.[0].bootstrap.api.apiKey).toBe(
      "replacement-key"
    );
    expect(
      onValue.mock.lastCall?.[0].bootstrap.wallet
        .disableInjectedProviderDiscovery
    ).toBe(true);
  });

  it("publishes only live input changes after the registry is created", async () => {
    const firstProvider = makeExternalProvider();
    const dynamicReplacement = makeExternalProvider({
      currentAddress: "0x0000000000000000000000000000000000000002",
      currentChain: optimism.id,
      supportedChainIds: [optimism.id],
    });
    const onConfig = vi.fn();
    const onDynamicWallet = vi.fn();
    const renderHarness = (
      externalProviders: SKExternalProviders,
      apiKey = "api-key"
    ) => (
      <SolanaProvider>
        <TestAtomRuntimeProvider
          settings={normalizeWidgetConfig({
            apiKey,
            externalProviders,
            variant: "default",
          })}
        >
          <RootInputPublicationObserver
            onConfig={onConfig}
            onDynamicWallet={onDynamicWallet}
          />
        </TestAtomRuntimeProvider>
      </SolanaProvider>
    );
    const app = await render(renderHarness(firstProvider));

    expect(onConfig).not.toHaveBeenCalled();
    expect(onDynamicWallet).toHaveBeenCalledOnce();
    onDynamicWallet.mockClear();

    await app.rerender(renderHarness(firstProvider, "replacement-key"));
    await vi.waitFor(() => expect(onConfig).toHaveBeenCalled());
    expect(onDynamicWallet).not.toHaveBeenCalled();
    onConfig.mockClear();

    await app.rerender(renderHarness(dynamicReplacement, "replacement-key"));
    await vi.waitFor(() => expect(onDynamicWallet).toHaveBeenCalled());
    expect(onConfig).toHaveBeenCalled();
  });
});
