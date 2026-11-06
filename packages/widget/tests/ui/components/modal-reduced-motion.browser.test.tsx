import { afterEach, describe, expect, it } from "vitest";
import { cdp } from "vitest/browser";

import { ThemeRoot } from "../../../src/ui/composition";
import { Modal } from "../../../src/ui/index";
import { render } from "../../utils/test-utils";

const emulateReducedMotion = (value: "reduce" | "") =>
  cdp().send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value }],
  });

/** How long the open Modal's popup takes to move, in seconds. */
const popupMotion = async () => {
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
      <Modal open title="Confirm" closeLabel="Close">
        Body
      </Modal>
    </ThemeRoot>
  );
  const popup = screen.getByRole("dialog", { name: "Confirm" });
  await expect.element(popup).toBeVisible();
  const duration = getComputedStyle(popup.element()).transitionDuration;

  await screen.unmount();
  return duration;
};

describe("Modal under reduced motion", () => {
  afterEach(async () => {
    await emulateReducedMotion("");
  });

  it("opens without animating", async () => {
    const animated = await popupMotion();
    await emulateReducedMotion("reduce");
    const reduced = await popupMotion();

    expect(animated).not.toBe("0s");
    expect(reduced).toBe("0s");
  });
});
