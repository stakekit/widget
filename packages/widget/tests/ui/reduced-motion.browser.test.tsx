import { MotionGlobalConfig } from "motion/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cdp } from "vitest/browser";

import { ThemeRoot } from "../../src/ui/composition";
import {
  AmountInput,
  AnimatedNumber,
  CompleteSummary,
  FlowSteps,
  Modal,
  PageTransition,
  WidgetFrame,
} from "../../src/ui/index";
import { motionEasing, motionSeconds } from "../../src/ui/tokens/motion-timing";
import { motion } from "../../src/ui/tokens/motion.stylex";
import { render } from "../utils/test-utils";

const emulateReducedMotion = (value: "reduce" | "") =>
  cdp().send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value }],
  });

const renderThemed = (children: ReactNode) =>
  render(
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
      {children}
    </ThemeRoot>
  );

const twoFrames = () => {
  const { promise, resolve } = Promise.withResolvers<void>();
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  return promise;
};

afterEach(async () => {
  await emulateReducedMotion("");
});

describe("Motion timings", () => {
  it("match the motion tokens", async () => {
    const keys = ["fast", "base", "slow"] as const;
    const screen = await renderThemed(
      keys.map((key) => (
        <div
          key={key}
          data-motion={key}
          style={{
            transitionDuration: motion[key],
            transitionTimingFunction: motion.easing,
          }}
        />
      ))
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

    expect(timings).toEqual(
      keys.map((key) => ({
        key,
        duration: `${motionSeconds[key]}s`,
        easing: `cubic-bezier(${motionEasing.join(", ")})`,
      }))
    );
  });
});

describe("CSS motion under reduced motion", () => {
  it("Modal opens without animating", async () => {
    /** How long the open Modal's popup takes to move, in seconds. */
    const popupMotion = async () => {
      const screen = await renderThemed(
        <Modal open title="Confirm" closeLabel="Close">
          Body
        </Modal>
      );
      const popup = screen.getByRole("dialog", { name: "Confirm" });
      await expect.element(popup).toBeVisible();
      const duration = getComputedStyle(popup.element()).transitionDuration;
      await screen.unmount();
      return duration;
    };

    const animated = await popupMotion();
    await emulateReducedMotion("reduce");
    const reduced = await popupMotion();

    expect(animated).not.toBe("0s");
    expect(reduced).toBe("0s");
  });

  it("AmountInput marks an invalid amount without moving", async () => {
    /** How long an invalid amount's feedback moves the input, in seconds. */
    const invalidMotion = async () => {
      const screen = await renderThemed(
        <AmountInput
          value="12"
          onValueChange={() => {}}
          separators={{ decimal: ".", group: "," }}
          label="Amount"
          invalid
        />
      );
      const input = screen.getByRole("textbox", { name: "Amount" });
      await expect.element(input).toHaveAttribute("aria-invalid", "true");
      const moving = input.element().parentElement;
      const duration = moving ? getComputedStyle(moving).animationDuration : "";
      await screen.unmount();
      return duration;
    };

    const animated = await invalidMotion();
    await emulateReducedMotion("reduce");
    const reduced = await invalidMotion();

    expect(animated).not.toBe("0s");
    expect(animated).not.toBe("");
    expect(reduced).toBe("0s");
  });

  it("Steps hold the signing halo, the arc and the connector fill still", async () => {
    /**
     * The signing halo's, the arc's and the connector fill's computed motion,
     * as a flow with a step signing and one being sent shows them.
     */
    const stepMotion = async () => {
      const screen = await renderThemed(
        <FlowSteps
          label="Transaction progress"
          stateLabels={{
            pending: "Waiting",
            active: "In progress",
            signing: "Waiting for signature",
            broadcasting: "Broadcasting",
            done: "Confirmed",
            failed: "Failed",
            cancelled: "Cancelled in wallet",
          }}
          steps={[
            { id: "approve", label: "Approve", state: "broadcasting" },
            { id: "stake", label: "Stake", state: "signing" },
            { id: "confirm", label: "Confirm", state: "pending" },
          ]}
        />
      );
      const part = (name: string) => {
        const element = screen.container.querySelector(
          `[data-step-part="${name}"]`
        );
        if (!(element instanceof HTMLElement)) {
          throw new Error(`Expected the step's ${name}.`);
        }
        return getComputedStyle(element);
      };
      const halo = part("halo");
      const arc = part("arc");
      const fill = part("connector-fill");
      const motion = {
        arc: { duration: arc.animationDuration, name: arc.animationName },
        fill: fill.transitionDuration,
        halo: {
          duration: halo.animationDuration,
          name: halo.animationName,
          opacity: halo.opacity,
        },
      };
      await screen.unmount();
      return motion;
    };

    const animated = await stepMotion();
    await emulateReducedMotion("reduce");
    const reduced = await stepMotion();

    expect(animated.halo.name).not.toBe("none");
    expect(animated.halo.duration).not.toBe("0s");
    expect(animated.arc.name).not.toBe("none");
    expect(animated.arc.duration).not.toBe("0s");
    expect(animated.fill).not.toBe("0s");

    expect(reduced.halo.duration).toBe("0s");
    expect(reduced.arc.duration).toBe("0s");
    expect(reduced.fill).toBe("0s");
    // Held still, the halo rests as a visible ring.
    expect(Number(reduced.halo.opacity)).toBeGreaterThan(0);
  });

  it("CompleteSummary shows its mark and check at once, without the success beat", async () => {
    /** How long the mark's entrance and its check's draw run, as CSS durations. */
    const markMotion = async () => {
      const screen = await renderThemed(
        <CompleteSummary title="Successfully staked 1 ETH" />
      );
      const mark = screen.getByTestId("complete-mark").element();
      const check = mark.querySelector("svg")?.parentElement;
      const beat = screen.getByTestId("complete-mark-beat").element();
      const durations = {
        entrance: getComputedStyle(mark).animationDuration,
        draw: check ? getComputedStyle(check).animationDuration : "",
        beat: getComputedStyle(beat).animationDuration,
      };
      await screen.unmount();
      return durations;
    };

    const animated = await markMotion();
    await emulateReducedMotion("reduce");
    const reduced = await markMotion();

    expect(animated.entrance).not.toBe("0s");
    expect(animated.draw).not.toBe("0s");
    expect(animated.draw).not.toBe("");
    expect(animated.beat).not.toBe("0s");
    expect(reduced).toEqual({ entrance: "0s", draw: "0s", beat: "0s" });
  });
});

const formatPercent = (value: number) => `${value.toFixed(2)}%`;

/**
 * The figure an AnimatedNumber paints two frames after it shows 100: on
 * mount, or, given `changeFrom`, after changing from that value.
 */
const paintedNumber = async (changeFrom: number | null) => {
  const screen = await render(
    <AnimatedNumber value={changeFrom ?? 100} format={formatPercent} />
  );
  if (changeFrom !== null) {
    await screen.rerender(
      <AnimatedNumber value={100} format={formatPercent} />
    );
  }
  await twoFrames();
  const shown =
    screen.container.querySelector("[aria-hidden='true']")?.textContent ?? "";
  await screen.unmount();
  return shown;
};

// The browser setup skips `motion` animations; these tests need them to run.
describe("Motion parts under reduced motion", () => {
  beforeEach(() => {
    MotionGlobalConfig.skipAnimations = false;
  });

  afterEach(() => {
    MotionGlobalConfig.skipAnimations = true;
  });

  it("AnimatedNumber shows the new value without counting", async () => {
    const animated = await paintedNumber(0);
    await emulateReducedMotion("reduce");
    const reduced = await paintedNumber(0);

    expect(animated).not.toBe("100.00%");
    expect(reduced).toBe("100.00%");
  });

  it("AnimatedNumber shows its value on mount, with or without motion", async () => {
    const animated = await paintedNumber(null);
    await emulateReducedMotion("reduce");
    const reduced = await paintedNumber(null);

    expect(animated).toBe("100.00%");
    expect(reduced).toBe("100.00%");
  });

  it("PageTransition swaps in the next page in its final state", async () => {
    const page = (key: string) => (
      <PageTransition pageKey={key} variant="rise">
        <p>{key}</p>
      </PageTransition>
    );
    /** The pages present, and the entering page's opacity, after a page change. */
    const pagesAfterChange = async () => {
      const screen = await render(page("Earn"));
      await screen.rerender(page("Positions"));
      await twoFrames();
      await twoFrames();
      const paragraphs = [...screen.container.querySelectorAll("p")];
      const entering = paragraphs.find(
        (paragraph) => paragraph.textContent === "Positions"
      )?.parentElement;
      const result = {
        present: paragraphs.map((paragraph) => paragraph.textContent),
        opacity: entering ? getComputedStyle(entering).opacity : "",
      };
      await screen.unmount();
      return result;
    };

    const animated = await pagesAfterChange();
    await emulateReducedMotion("reduce");
    const reduced = await pagesAfterChange();

    expect(animated.present).toContain("Earn");
    expect(animated.opacity).not.toBe("1");
    expect(reduced.present).toEqual(["Positions"]);
    expect(reduced.opacity).toBe("1");
  });

  it("PageTransition reports the exit, also under reduced motion", async () => {
    /** Waits until `onExitComplete` runs once the leaving page left. */
    const exitCompletesAfterChange = async () => {
      const onExitComplete = vi.fn();
      const page = (key: string) => (
        <PageTransition
          pageKey={key}
          variant="rise"
          onExitComplete={onExitComplete}
        >
          <p>{key}</p>
        </PageTransition>
      );
      const screen = await render(page("Earn"));
      await screen.rerender(page("Positions"));
      await vi.waitFor(() => expect(onExitComplete).toHaveBeenCalledOnce());
      await screen.unmount();
    };

    await exitCompletesAfterChange();
    await emulateReducedMotion("reduce");
    await exitCompletesAfterChange();
  });

  it("WidgetFrame shows at its height without a reveal", async () => {
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
      await twoFrames();
      const height =
        screen.container.firstElementChild?.getBoundingClientRect().height ??
        -1;
      await screen.unmount();
      return height;
    };

    const animated = await frameHeightBeforeReady();
    await emulateReducedMotion("reduce");
    const reduced = await frameHeightBeforeReady();

    expect(animated).toBe(0);
    expect(reduced).toBeGreaterThan(0);
  });
});
