import { afterEach, describe, expect, it } from "vitest";
import { cdp } from "vitest/browser";

import { ThemeRoot } from "../../../src/ui/composition";
import { FlowSteps } from "../../../src/ui/index";
import { render } from "../../utils/test-utils";

const emulateReducedMotion = (value: "reduce" | "") =>
  cdp().send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value }],
  });

const stateLabels = {
  pending: "Waiting",
  active: "In progress",
  signing: "Waiting for signature",
  broadcasting: "Broadcasting",
  done: "Confirmed",
  failed: "Failed",
  cancelled: "Cancelled in wallet",
} as const;

/**
 * The signing halo's, the arc's and the connector fill's computed motion, as
 * a flow with a step signing and one being sent shows them.
 */
const stepMotion = async () => {
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
      <FlowSteps
        label="Transaction progress"
        stateLabels={stateLabels}
        steps={[
          { id: "approve", label: "Approve", state: "broadcasting" },
          { id: "stake", label: "Stake", state: "signing" },
          { id: "confirm", label: "Confirm", state: "pending" },
        ]}
      />
    </ThemeRoot>
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

describe("Steps under reduced motion", () => {
  afterEach(async () => {
    await emulateReducedMotion("");
  });

  it("holds the signing halo, the arc and the connector fill still", async () => {
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
});
