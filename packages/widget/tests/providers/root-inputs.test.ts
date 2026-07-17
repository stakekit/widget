import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { mainnet } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import {
  normalizeWidgetBootstrapConfig,
  normalizeWidgetConfig,
  widgetBootstrapConfigAtom,
  widgetConfigAtom,
} from "../../src/app/config";
import {
  defaultSolanaWalletInput,
  dynamicExternalProviderInputAtom,
  normalizeDynamicExternalProviderInput,
  solanaWalletInputAtom,
} from "../../src/app/runtime/root-inputs";
import { walletInitializationKeyAtom } from "../../src/features/wallet";
import type { SKExternalProviders } from "../../src/public-api/types";
import { defaultWidgetBootstrapConfig } from "../../src/services/config/widget-config";

const makeExternalProvider = (
  overrides: Partial<SKExternalProviders> = {}
): SKExternalProviders => ({
  currentAddress: "0x0000000000000000000000000000000000000001",
  currentChain: mainnet.id,
  initToken: "ethereum-eth",
  provider: {
    sendTransaction: vi.fn(async () => "transaction-hash"),
    signMessage: vi.fn(async () => "signed-message"),
    switchChain: vi.fn(async () => undefined),
  },
  supportedChainIds: [10, mainnet.id, 10],
  type: "generic",
  ...overrides,
});

const makeSettings = (externalProviders: SKExternalProviders) =>
  normalizeWidgetConfig({
    apiKey: "api-key",
    externalProviders,
    variant: "default",
  });

describe("registry root input models", () => {
  it("keeps static external-provider topology in bootstrap config", () => {
    const firstProvider = makeExternalProvider();
    const replacementProvider = makeExternalProvider({
      currentAddress: "0x0000000000000000000000000000000000000002",
      currentChain: 10,
      provider: {
        sendTransaction: vi.fn(async () => "replacement-hash"),
        signMessage: vi.fn(async () => "replacement-signature"),
        switchChain: vi.fn(async () => undefined),
      },
      supportedChainIds: [10],
    });

    const first = normalizeWidgetBootstrapConfig({
      isLedgerLive: false,
      settings: makeSettings(firstProvider),
    });
    const replacement = normalizeWidgetBootstrapConfig({
      isLedgerLive: false,
      settings: makeSettings(replacementProvider),
    });

    expect(replacement).toEqual(first);
    expect(normalizeDynamicExternalProviderInput(firstProvider)).not.toEqual(
      normalizeDynamicExternalProviderInput(replacementProvider)
    );
  });

  it("canonicalizes supported chain ids without hiding callback freshness", () => {
    const externalProvider = makeExternalProvider();
    const normalized = normalizeDynamicExternalProviderInput(externalProvider);

    expect(normalized?.supportedChainIds).toEqual([1, 10]);
    expect(normalized?.provider).toBe(externalProvider.provider);
  });

  it("publishes derived external-provider changes only when its settings change", () => {
    const firstProvider = makeExternalProvider();
    const replacementProvider = makeExternalProvider({
      currentAddress: "0x0000000000000000000000000000000000000002",
    });
    const registry = AtomRegistry.make();
    const onChange = vi.fn();
    const firstSettings = makeSettings(firstProvider);

    registry.set(widgetConfigAtom, firstSettings);
    const unsubscribe = registry.subscribe(
      dynamicExternalProviderInputAtom,
      onChange,
      { immediate: true }
    );
    expect(onChange).toHaveBeenCalledOnce();
    onChange.mockClear();
    registry.set(widgetConfigAtom, {
      ...firstSettings,
      tracking: { trackEvent: vi.fn() },
    });
    expect(onChange).not.toHaveBeenCalled();

    registry.set(widgetConfigAtom, makeSettings(replacementProvider));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        currentAddress: replacementProvider.currentAddress,
      })
    );
    unsubscribe();
  });

  it("exposes deterministic defaults", () => {
    const registry = AtomRegistry.make();

    expect(registry.get(widgetBootstrapConfigAtom)).toEqual(
      defaultWidgetBootstrapConfig
    );
    expect(registry.get(dynamicExternalProviderInputAtom)).toBeNull();
    expect(registry.get(solanaWalletInputAtom)).toBe(defaultSolanaWalletInput);
  });

  it("compares Solana identities while accepting equivalent array wrappers", () => {
    const registry = AtomRegistry.make();
    const onChange = vi.fn();
    const wallet = {} as (typeof defaultSolanaWalletInput.wallets)[number];

    registry.set(solanaWalletInputAtom, {
      connection: null,
      wallets: [wallet],
    });
    const unsubscribe = registry.subscribe(solanaWalletInputAtom, onChange);
    registry.set(solanaWalletInputAtom, {
      connection: null,
      wallets: [wallet],
    });
    expect(onChange).not.toHaveBeenCalled();

    const replacementWallet = {} as typeof wallet;
    registry.set(solanaWalletInputAtom, {
      connection: null,
      wallets: [replacementWallet],
    });
    expect(registry.get(solanaWalletInputAtom).wallets[0]).toBe(
      replacementWallet
    );
    expect(onChange).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("derives wallet initialization from registry inputs with isolated provider refs", () => {
    const firstProvider = makeExternalProvider();
    const replacementProvider = makeExternalProvider({
      currentAddress: "0x0000000000000000000000000000000000000002",
    });
    const firstRegistry = AtomRegistry.make();
    const secondRegistry = AtomRegistry.make();

    firstRegistry.set(widgetConfigAtom, makeSettings(firstProvider));
    const firstKey = firstRegistry.get(walletInitializationKeyAtom);
    const firstRef = firstKey.externalProviders;

    firstRegistry.set(widgetConfigAtom, makeSettings(replacementProvider));
    const replacementKey = firstRegistry.get(walletInitializationKeyAtom);

    expect(replacementKey.externalProviders).toBe(firstRef);
    expect(firstRef?.current.currentAddress).toBe(
      replacementProvider.currentAddress
    );

    secondRegistry.set(widgetConfigAtom, makeSettings(firstProvider));
    const secondKey = secondRegistry.get(walletInitializationKeyAtom);

    expect(secondKey.externalProviders).not.toBe(firstRef);
  });
});
