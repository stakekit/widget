import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import { normalizeWidgetConfig, widgetConfigAtom } from "../../src/app/config";
import { mountAnimationStateAtom } from "../../src/features/mount-animation";

vi.mock("../../src/shared/config/widget-defaults", async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import("../../src/shared/config/widget-defaults")
    >();

  return {
    ...original,
    config: {
      ...original.config,
      env: {
        ...original.config.env,
        isTestMode: false,
      },
    },
  };
});

const makeWidgetConfig = (dashboardVariant: boolean) =>
  normalizeWidgetConfig({
    apiKey: "api-key",
    dashboardVariant,
    variant: "default",
  });

describe("mount animation state", () => {
  it("tracks page and layout completion in the registry", () => {
    const registry = AtomRegistry.make({
      initialValues: [[widgetConfigAtom, makeWidgetConfig(false)]],
    });

    expect(registry.get(mountAnimationStateAtom)).toEqual({
      earnPage: false,
      layout: false,
    });

    registry.set(mountAnimationStateAtom, { type: "layout" });
    expect(registry.get(mountAnimationStateAtom)).toEqual({
      earnPage: false,
      layout: true,
    });

    registry.set(mountAnimationStateAtom, { type: "all" });
    expect(registry.get(mountAnimationStateAtom)).toEqual({
      earnPage: true,
      layout: true,
    });
  });

  it("derives its initial state from the initial widget configuration", () => {
    const registry = AtomRegistry.make({
      initialValues: [[widgetConfigAtom, makeWidgetConfig(true)]],
    });

    expect(registry.get(mountAnimationStateAtom)).toEqual({
      earnPage: true,
      layout: true,
    });

    registry.set(widgetConfigAtom, makeWidgetConfig(false));

    expect(registry.get(mountAnimationStateAtom)).toEqual({
      earnPage: true,
      layout: true,
    });
  });
});
