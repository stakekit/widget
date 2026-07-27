import { MotionGlobalConfig } from "motion/react";
import { afterEach } from "vitest";
import { describe, expect, it } from "../utils/test-extend";
import { renderApp } from "../utils/test-utils";

/**
 * These cases pin the rendered outcome of the reveal gate — that both host
 * configurations still reveal and still notify the host. They deliberately do
 * not assert gate timing: this environment measures the widget's geometry later
 * than the gate's own deadline, so the gate is already open by the time a height
 * can be observed. Its timing and bounded fallback are pinned deterministically
 * in `tests/features/mount-reveal-gate.test.ts`.
 */
const revealDeadlineMillis = 6_000;

const nextAnimationFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

const containerHeight = (container: HTMLElement) =>
  container
    .querySelector<HTMLElement>("[data-rk='widget-container']")
    ?.getBoundingClientRect().height ?? -1;

/**
 * Samples the container's height every frame until the host is told the mount
 * animation finished, so a test can tell a reveal that ramped from one that
 * jumped.
 */
const recordReveal = async (skProps: {
  readonly disableInitLayoutAnimation?: boolean;
}) => {
  let complete = false;
  const app = await renderApp({
    skProps: {
      apiKey: import.meta.env.VITE_API_KEY,
      disableInitLayoutAnimation: false,
      onMountAnimationComplete: () => {
        complete = true;
      },
      ...skProps,
      variant: "default",
    },
  });
  const startedAt = performance.now();
  const heights = [containerHeight(app.container)];

  while (!complete && performance.now() - startedAt < revealDeadlineMillis) {
    await nextAnimationFrame();
    heights.push(containerHeight(app.container));
  }

  app.unmount();

  return { complete, heights };
};

afterEach(() => {
  MotionGlobalConfig.skipAnimations = true;
});

describe("classic mount reveal gate", () => {
  it("still ramps the height open and reports completion", async () => {
    MotionGlobalConfig.skipAnimations = false;

    const { complete, heights } = await recordReveal({});
    const fullHeight = Math.max(...heights);

    expect(complete).toBe(true);
    expect(heights[0]).toBeLessThan(2);
    expect(fullHeight).toBeGreaterThan(300);
    // The gate replaced the transition's fixed delay, not the transition: the
    // reveal is still an animation, so intermediate heights must be observed.
    expect(
      heights.filter((height) => height > 2 && height < fullHeight - 1).length
    ).toBeGreaterThan(2);
  });

  it("reveals in one step when the host disables the init layout animation", async () => {
    MotionGlobalConfig.skipAnimations = false;

    const { complete, heights } = await recordReveal({
      disableInitLayoutAnimation: true,
    });
    const fullHeight = Math.max(...heights);

    expect(complete).toBe(true);
    expect(fullHeight).toBeGreaterThan(300);
    // A host that asked for no init animation still gets none: the height
    // reaches its target in one step rather than ramping.
    expect(
      heights.filter((height) => height > 2 && height < fullHeight - 1).length
    ).toBe(0);
  });
});
