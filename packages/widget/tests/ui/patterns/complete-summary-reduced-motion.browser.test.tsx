import { afterEach, describe, expect, it } from "vitest";
import { cdp } from "vitest/browser";
import { ThemeRoot } from "../../../src/ui/composition";
import { CompleteSummary } from "../../../src/ui/index";
import { render } from "../../utils/test-utils";

const emulateReducedMotion = (value: "reduce" | "") =>
  cdp().send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value }],
  });

/** How long the mark's entrance and its check's draw run, as CSS durations. */
const markMotion = async () => {
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
      <CompleteSummary title="Successfully staked 1 ETH" />
    </ThemeRoot>
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

describe("CompleteSummary under reduced motion", () => {
  afterEach(async () => {
    await emulateReducedMotion("");
  });

  it("shows its mark and check at once, without the success beat", async () => {
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
