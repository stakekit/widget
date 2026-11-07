import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cdp } from "vitest/browser";
import { ThemeRoot } from "../../../src/ui/composition";
import {
  AnimatedNumber,
  PageTransition,
  WidgetFrame,
} from "../../../src/ui/index";
import { motion } from "../../../src/ui/tokens/motion.stylex";
import {
  motionEasing,
  motionSeconds,
} from "../../../src/ui/tokens/motion-timing";
import { render } from "../../utils/test-utils";

const emulateReducedMotion = (value: "reduce" | "") =>
  cdp().send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value }],
  });

const nextFrame = () => {
  const { promise, resolve } = Promise.withResolvers<void>();
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  return promise;
};

const formatPercent = (value: number) => `${value.toFixed(2)}%`;

/** The figure painted two frames after the value changes from 0 to 100. */
const numberAfterChange = async () => {
  const screen = await render(
    <AnimatedNumber value={0} format={formatPercent} />
  );
  await screen.rerender(<AnimatedNumber value={100} format={formatPercent} />);
  await nextFrame();
  const painted = screen.container.querySelector("[aria-hidden='true']");
  const shown = painted?.textContent ?? "";
  await screen.unmount();
  return shown;
};

const page = (key: string) => (
  <PageTransition pageKey={key} variant="rise">
    <p>{key}</p>
  </PageTransition>
);

/** The pages present, and the entering page's opacity, two frames after a page change. */
const pagesAfterChange = async () => {
  const screen = await render(page("Earn"));
  await screen.rerender(page("Positions"));
  await nextFrame();
  await nextFrame();
  const present = [...screen.container.querySelectorAll("p")].map(
    (paragraph) => paragraph.textContent
  );
  const entering = [...screen.container.querySelectorAll("p")].find(
    (paragraph) => paragraph.textContent === "Positions"
  )?.parentElement;
  const opacity =
    entering === undefined || entering === null
      ? ""
      : getComputedStyle(entering).opacity;
  await screen.unmount();
  return { present, opacity };
};

/** The figure painted two frames after mounting with a value of 100. */
const numberAfterMount = async () => {
  const screen = await render(
    <AnimatedNumber value={100} format={formatPercent} />
  );
  await nextFrame();
  const painted = screen.container.querySelector("[aria-hidden='true']");
  const shown = painted?.textContent ?? "";
  await screen.unmount();
  return shown;
};

/** Whether `onExitComplete` ran once the leaving page left. */
const exitCompletesAfterChange = async () => {
  const onExitComplete = vi.fn();
  const pageWith = (key: string) => (
    <PageTransition
      pageKey={key}
      variant="rise"
      onExitComplete={onExitComplete}
    >
      <p>{key}</p>
    </PageTransition>
  );
  const screen = await render(pageWith("Earn"));
  await screen.rerender(pageWith("Positions"));
  await vi.waitFor(() => expect(onExitComplete).toHaveBeenCalledOnce());
  await screen.unmount();
};

/** The frame's height two frames after mounting with a reveal not yet ready. */
const frameHeightBeforeReady = async () => {
  const screen = await render(
    <WidgetFrame
      poweredByLabel="Powered by"
      brandName="StakeKit"
      reveal={{ ready: false }}
    >
      <p>Earn</p>
    </WidgetFrame>
  );
  await nextFrame();
  const frame = screen.container.firstElementChild;
  const height = frame?.getBoundingClientRect().height ?? -1;
  await screen.unmount();
  return height;
};

/** Each motion token's computed value, read through a themed element. */
const tokenTimings = async () => {
  const screen = await render(
    <ThemeRoot
      appearance={{}}
      appearancePreset="default"
      callToActionSize="lg"
      colorScheme="light"
      gutter="md"
      surfaceStyle="filled"
      tabsIndicator="underline"
      portalContainer={undefined}
    >
      {(["fast", "base", "slow"] as const).map((key) => (
        <div
          key={key}
          data-motion={key}
          style={{
            transitionDuration: motion[key],
            transitionTimingFunction: motion.easing,
          }}
        />
      ))}
    </ThemeRoot>
  );
  const timings = [...screen.container.querySelectorAll("[data-motion]")].map(
    (element) => {
      const style = getComputedStyle(element);
      return {
        key: element.getAttribute("data-motion"),
        duration: style.transitionDuration,
        easing: style.transitionTimingFunction,
      };
    }
  );
  await screen.unmount();
  return timings;
};

describe("Motion timings", () => {
  it("match the motion tokens", async () => {
    const easing = `cubic-bezier(${motionEasing.join(", ")})`;

    expect(await tokenTimings()).toEqual(
      (["fast", "base", "slow"] as const).map((key) => ({
        key,
        duration: `${motionSeconds[key]}s`,
        easing,
      }))
    );
  });
});

// The browser setup skips `motion` animations; these tests need them to run.
describe("Motion parts under reduced motion", () => {
  beforeEach(() => {
    MotionGlobalConfig.skipAnimations = false;
  });

  afterEach(async () => {
    MotionGlobalConfig.skipAnimations = true;
    await emulateReducedMotion("");
  });

  it("AnimatedNumber shows the new value without counting", async () => {
    const animated = await numberAfterChange();
    await emulateReducedMotion("reduce");
    const reduced = await numberAfterChange();

    expect(animated).not.toBe("100.00%");
    expect(reduced).toBe("100.00%");
  });

  it("AnimatedNumber shows its value on mount, with or without motion", async () => {
    const animated = await numberAfterMount();
    await emulateReducedMotion("reduce");
    const reduced = await numberAfterMount();

    expect(animated).toBe("100.00%");
    expect(reduced).toBe("100.00%");
  });

  it("PageTransition swaps in the next page in its final state", async () => {
    const animated = await pagesAfterChange();
    await emulateReducedMotion("reduce");
    const reduced = await pagesAfterChange();

    expect(animated.present).toContain("Earn");
    expect(animated.opacity).not.toBe("1");
    expect(reduced.present).toEqual(["Positions"]);
    expect(reduced.opacity).toBe("1");
  });

  it("PageTransition reports the exit, also under reduced motion", async () => {
    await exitCompletesAfterChange();
    await emulateReducedMotion("reduce");
    await exitCompletesAfterChange();
  });

  it("WidgetFrame shows at its height without a reveal", async () => {
    const animated = await frameHeightBeforeReady();
    await emulateReducedMotion("reduce");
    const reduced = await frameHeightBeforeReady();

    expect(animated).toBe(0);
    expect(reduced).toBeGreaterThan(0);
  });
});
