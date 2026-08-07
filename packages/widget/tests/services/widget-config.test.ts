import { describe, expect, it } from "vitest";
import { normalizeWidgetConfig } from "../../src/app/config/settings";
import type { SettingsProps } from "../../src/public-api/types";
import {
  diffWidgetWalletConfig,
  normalizeWidgetBootstrapConfig,
} from "../../src/services/config/widget-config";

const walletTopology = (overrides: Partial<SettingsProps> = {}) => {
  const settings = normalizeWidgetConfig({
    ...overrides,
    apiKey: "api-key",
    variant: "default",
  });

  return normalizeWidgetBootstrapConfig({
    isLedgerLive: settings.isLedgerLive,
    settings,
  }).wallet;
};

describe("wallet topology difference", () => {
  it("reports nothing for separately built but equal configurations", () => {
    const difference = diffWidgetWalletConfig(
      walletTopology({ chainIconMapping: { ethereum: "eth.svg" } }),
      walletTopology({ chainIconMapping: { ethereum: "eth.svg" } })
    );

    expect(difference).toEqual({ material: [], opaque: [] });
  });

  it("reports a comparable field as material", () => {
    const difference = diffWidgetWalletConfig(
      walletTopology({ isSafe: true }),
      walletTopology()
    );

    expect(difference.material).toEqual(["isSafe"]);
    expect(difference.opaque).toEqual([]);
  });

  it("reports record mappings by value", () => {
    const difference = diffWidgetWalletConfig(
      walletTopology({ chainIconMapping: { ethereum: "next.svg" } }),
      walletTopology({ chainIconMapping: { ethereum: "eth.svg" } })
    );

    expect(difference.material).toEqual(["chainIconMapping"]);
    expect(difference.opaque).toEqual([]);
  });

  it("reports host functions as opaque rather than material", () => {
    const difference = diffWidgetWalletConfig(
      walletTopology({
        chainIconMapping: () => "eth.svg",
        mapWalletFn: (wallet) => wallet,
        mapWalletListFn: (wallets) => wallets,
      }),
      walletTopology({
        chainIconMapping: () => "eth.svg",
        mapWalletFn: (wallet) => wallet,
        mapWalletListFn: (wallets) => wallets,
      })
    );

    expect(difference.material).toEqual([]);
    expect(difference.opaque).toEqual([
      "chainIconMapping",
      "mapWalletFn",
      "mapWalletListFn",
    ]);
  });

  it("separates a material change from a simultaneous function change", () => {
    const difference = diffWidgetWalletConfig(
      walletTopology({ isSafe: true, mapWalletFn: (wallet) => wallet }),
      walletTopology({ isSafe: false, mapWalletFn: (wallet) => wallet })
    );

    expect(difference.material).toEqual(["isSafe"]);
    expect(difference.opaque).toEqual(["mapWalletFn"]);
  });
});
