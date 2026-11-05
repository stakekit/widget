import { describe, expect, it } from "vitest";
import { cdp, userEvent } from "vitest/browser";
import type { ColorScheme } from "../../../src/ui/composition";
import { ThemeRoot } from "../../../src/ui/composition";
import { Button } from "../../../src/ui/index";
import { render } from "../../utils/test-utils";

/** Moves the primary mouse button at an element's center, down or up. */
const mouse = async (
  type: "mousePressed" | "mouseReleased",
  element: Element
) => {
  const box = element.getBoundingClientRect();
  await cdp().send("Input.dispatchMouseEvent", {
    type,
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
    button: "left",
    clickCount: 1,
  });
};

/** An element's style once its running transitions finish. */
const settledStyle = async (element: Element) => {
  await Promise.all(
    element.getAnimations().map((animation) => animation.finished)
  );
  return getComputedStyle(element);
};

/**
 * `:hover` and `:active` follow only a real pointer, so this hovers and
 * presses through Playwright and the DevTools protocol rather than a story's
 * dispatched events. Hover fills the primary and soft buttons and outlines
 * the danger one; a press changes each one's fill past its hover.
 */
describe.each<ColorScheme>(["light", "dark"])("Button in %s", (colorScheme) => {
  it.each([
    ["primary", "backgroundColor"],
    ["soft", "backgroundColor"],
    ["danger", "borderTopColor"],
  ] as const)(
    "changes the %s button's %s on hover and its fill while pressed",
    async (variant, hoverProperty) => {
      const screen = await render(
        <ThemeRoot
          appearance={{}}
          appearancePreset="default"
          callToActionSize="lg"
          colorScheme={colorScheme}
          gutter="md"
          surfaceStyle="filled"
          tabsIndicator="underline"
          portalContainer={undefined}
        >
          <Button variant={variant}>Stake</Button>
        </ThemeRoot>
      );
      const button = screen.getByRole("button", { name: "Stake" }).element();
      const resting = await settledStyle(button);
      const restingHover = resting[hoverProperty];
      const restingFill = resting.backgroundColor;

      await userEvent.hover(button);
      await expect
        .poll(() => getComputedStyle(button)[hoverProperty])
        .not.toBe(restingHover);
      const hoveredFill = (await settledStyle(button)).backgroundColor;

      await mouse("mousePressed", button);
      await expect
        .poll(() => getComputedStyle(button).backgroundColor)
        .not.toBe(hoveredFill);
      const pressedFill = (await settledStyle(button)).backgroundColor;
      await mouse("mouseReleased", button);

      expect(pressedFill).not.toBe(restingFill);
    }
  );
});
