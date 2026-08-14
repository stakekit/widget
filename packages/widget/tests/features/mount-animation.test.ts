import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import { updateWidgetConfigAtom } from "../../src/app/runtime/widget-config";
import {
  mountAnimationCompletionAtom,
  mountAnimationStateAtom,
} from "../../src/features/mount-animation/state";
import { applicationRuntimeInitInitialValue } from "../utils/widget-config";

const makeWidgetConfig = (
  dashboardVariant: boolean,
  onMountAnimationComplete?: () => void
) => ({
  apiKey: "api-key",
  dashboardVariant,
  disableInitLayoutAnimation: false,
  onMountAnimationComplete,
  variant: "default" as const,
});

describe("mount animation state", () => {
  it("tracks page and layout completion in the registry", () => {
    const registry = AtomRegistry.make({
      initialValues: [
        applicationRuntimeInitInitialValue(makeWidgetConfig(false)),
      ],
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
      initialValues: [
        applicationRuntimeInitInitialValue(makeWidgetConfig(true)),
      ],
    });

    expect(registry.get(mountAnimationStateAtom)).toEqual({
      earnPage: true,
      layout: true,
    });

    registry.set(updateWidgetConfigAtom, makeWidgetConfig(false));

    expect(registry.get(mountAnimationStateAtom)).toEqual({
      earnPage: true,
      layout: true,
    });
  });

  it("notifies the host once, no matter how often a step is dispatched", () => {
    const onMountAnimationComplete = vi.fn();
    const registry = AtomRegistry.make({
      initialValues: [
        applicationRuntimeInitInitialValue(
          makeWidgetConfig(false, onMountAnimationComplete)
        ),
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
        applicationRuntimeInitInitialValue(
          makeWidgetConfig(true, onMountAnimationComplete)
        ),
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
