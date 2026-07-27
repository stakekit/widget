import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import {
  normalizeWidgetConfig,
  widgetConfigAtom,
  widgetConfigFieldAtom,
} from "../../src/app/config/settings";
import { widgetBootstrapConfigAtom } from "../../src/app/config/widget-config";
import { InvalidBorrowFeatureConfiguration } from "../../src/domain/borrow/availability";

describe("widget configuration", () => {
  it("normalizes defaults, category order, and token preference keys", () => {
    const settings = normalizeWidgetConfig({
      apiKey: "api-key",
      dashboardVariant: true,
      dashboardYieldCategoryOrder: ["stake", "stake", "rwa"],
      preferredTokenYieldsPerNetwork: {
        ethereum: {
          "ETHEREUM-ETH": "ethereum-eth-native-staking",
        },
      },
      variant: "default",
    });

    expect(settings).toMatchObject({
      borrowEnabled: false,
      dashboardYieldCategoryOrder: ["stake", "rwa", "defi"],
      yieldGrouping: "category",
    });
    expect(settings.preferredTokenYieldsPerNetwork).toEqual({
      ethereum: {
        "ethereum-eth": "ethereum-eth-native-staking",
      },
    });
  });

  it("does not mutate host wallet configuration while normalizing", () => {
    const customConnectors = vi.fn();
    const wagmi = { __customConnectors__: customConnectors };

    const settings = normalizeWidgetConfig({
      apiKey: "api-key",
      variant: "default",
      wagmi,
    });

    expect(wagmi.__customConnectors__).toBe(customConnectors);
    expect(settings.wagmi?.__customConnectors__).toBe(customConnectors);
  });

  it("accepts Borrow only in the category-grouped dashboard", () => {
    expect(
      normalizeWidgetConfig({
        apiKey: "api-key",
        borrowEnabled: true,
        dashboardVariant: true,
        variant: "default",
      })
    ).toMatchObject({
      borrowEnabled: true,
      dashboardVariant: true,
      yieldGrouping: "category",
    });
  });

  it("rejects Borrow outside the dashboard", () => {
    expect(() =>
      normalizeWidgetConfig({
        apiKey: "api-key",
        borrowEnabled: true,
        variant: "default",
      })
    ).toThrow(InvalidBorrowFeatureConfiguration);
  });

  it("rejects Borrow with flat yield grouping", () => {
    expect(() =>
      normalizeWidgetConfig({
        apiKey: "api-key",
        borrowEnabled: true,
        dashboardVariant: true,
        variant: "default",
        yieldGrouping: "flat",
      })
    ).toThrow(InvalidBorrowFeatureConfiguration);
  });

  it("derives focused React fields and Effect bootstrap configuration from one atom", () => {
    const registry = AtomRegistry.make();
    const variantAtom = widgetConfigFieldAtom("variant");
    const portalContainerAtom = widgetConfigFieldAtom("portalContainer");
    const portalContainer = {} as HTMLElement;

    registry.set(
      widgetConfigAtom,
      normalizeWidgetConfig({
        apiKey: "api-key",
        baseUrl: "https://legacy.example.com",
        borrowApiUrl: "https://borrow.example.com",
        portalContainer,
        variant: "utila",
        yieldsApiUrl: "https://yields.example.com",
      })
    );

    expect(registry.get(variantAtom)).toBe("utila");
    expect(registry.get(portalContainerAtom)).toBe(portalContainer);
    expect(registry.get(widgetBootstrapConfigAtom)).toMatchObject({
      api: {
        apiKey: "api-key",
        baseUrl: "https://legacy.example.com",
        borrowApiUrl: "https://borrow.example.com",
        yieldsApiUrl: "https://yields.example.com",
      },
      tracking: { variant: "utila" },
      wallet: { variant: "utila" },
    });
  });
});
