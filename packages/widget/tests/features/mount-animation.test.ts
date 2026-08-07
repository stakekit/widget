import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import {
  normalizeWidgetConfig,
  widgetConfigAtom,
} from "../../src/app/config/settings";
import {
  mountAnimationCompletionAtom,
  mountAnimationStateAtom,
} from "../../src/features/mount-animation/state";

const makeWidgetConfig = (
  dashboardVariant: boolean,
  onMountAnimationComplete?: () => void
) =>
  normalizeWidgetConfig({
    apiKey: "api-key",
    dashboardVariant,
    disableInitLayoutAnimation: false,
    onMountAnimationComplete,
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

  it("notifies the host once, no matter how often a step is dispatched", () => {
    const onMountAnimationComplete = vi.fn();
    const registry = AtomRegistry.make({
      initialValues: [
        [widgetConfigAtom, makeWidgetConfig(false, onMountAnimationComplete)],
      ],
    });

    const unmount = registry.mount(mountAnimationCompletionAtom);

    try {
      expect(onMountAnimationComplete).not.toHaveBeenCalled();

      registry.set(mountAnimationStateAtom, { type: "layout" });
      registry.set(mountAnimationStateAtom, { type: "earnPage" });
      expect(onMountAnimationComplete).toHaveBeenCalledTimes(1);

      registry.set(mountAnimationStateAtom, { type: "all" });
      registry.set(mountAnimationStateAtom, { type: "layout" });
      expect(onMountAnimationComplete).toHaveBeenCalledTimes(1);
    } finally {
      unmount();
    }
  });

  it("notifies the host for variants whose animation starts finished", () => {
    const onMountAnimationComplete = vi.fn();
    const registry = AtomRegistry.make({
      initialValues: [
        [widgetConfigAtom, makeWidgetConfig(true, onMountAnimationComplete)],
      ],
    });

    const unmount = registry.mount(mountAnimationCompletionAtom);

    try {
      expect(onMountAnimationComplete).toHaveBeenCalledTimes(1);
    } finally {
      unmount();
    }
  });
});
