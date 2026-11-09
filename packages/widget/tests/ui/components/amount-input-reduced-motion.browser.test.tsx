import { afterEach, describe, expect, it } from "vitest";
import { cdp } from "vitest/browser";
import { ThemeRoot } from "../../../src/ui/composition";
import { AmountInput } from "../../../src/ui/index";
import { render } from "../../utils/test-utils";

const emulateReducedMotion = (value: "reduce" | "") =>
  cdp().send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value }],
  });

/** How long an invalid amount's feedback moves the input, in seconds. */
const invalidMotion = async () => {
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
      <AmountInput
        value="12"
        onValueChange={() => {}}
        separators={{ decimal: ".", group: "," }}
        label="Amount"
        invalid
      />
    </ThemeRoot>
  );
  const input = screen.getByRole("textbox", { name: "Amount" });
  await expect.element(input).toHaveAttribute("aria-invalid", "true");
  const moving = input.element().parentElement;
  const duration = moving ? getComputedStyle(moving).animationDuration : "";

  await screen.unmount();
  return duration;
};

describe("AmountInput under reduced motion", () => {
  afterEach(async () => {
    await emulateReducedMotion("");
  });

  it("marks an invalid amount without moving", async () => {
    const animated = await invalidMotion();
    await emulateReducedMotion("reduce");
    const reduced = await invalidMotion();

    expect(animated).not.toBe("0s");
    expect(animated).not.toBe("");
    expect(reduced).toBe("0s");
  });
});
