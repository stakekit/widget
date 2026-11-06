import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import { ThemeRoot } from "../../../src/ui/composition";
import { InfoTip } from "../../../src/ui/index";
import { render } from "../../utils/test-utils";

const explanation = "The yearly reward rate, before fees.";

/**
 * Whether focus opens the InfoTip hangs on `:focus-visible`, which Chromium
 * sets only from trusted input, so these use Playwright's real pointer and
 * keyboard rather than a story's dispatched events.
 */
const renderInfoTip = () =>
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
      <div style={{ display: "flex", gap: 8, paddingTop: 96 }}>
        <button
          type="button"
          onClick={(event) =>
            event.currentTarget.parentElement
              ?.querySelector<HTMLButtonElement>(
                '[aria-label="About the reward rate"]'
              )
              ?.focus()
          }
        >
          Return focus
        </button>
        <InfoTip label="About the reward rate">{explanation}</InfoTip>
      </div>
    </ThemeRoot>
  );

const nextFrame = () => {
  const frame = Promise.withResolvers<void>();
  requestAnimationFrame(() => frame.resolve());
  return frame.promise;
};

describe("InfoTip", () => {
  it("opens on a press and stays open after the focus the press gives", async () => {
    const screen = await renderInfoTip();
    const button = screen.getByRole("button", {
      name: "About the reward rate",
    });
    await expect.element(button).not.toHaveFocus();

    await userEvent.click(button);
    await nextFrame();

    await expect.element(button).toHaveFocus();
    await expect.element(button).toHaveAttribute("aria-expanded", "true");
    await expect.element(screen.getByText(explanation)).toBeVisible();

    await userEvent.click(button);
    await expect.element(button).toHaveAttribute("aria-expanded", "false");
  });

  it("stays closed when a script returns focus to it after a press", async () => {
    const screen = await renderInfoTip();
    const button = screen.getByRole("button", {
      name: "About the reward rate",
    });

    await userEvent.click(screen.getByRole("button", { name: "Return focus" }));
    await nextFrame();

    await expect.element(button).toHaveFocus();
    await expect.element(button).toHaveAttribute("aria-expanded", "false");
    await expect.element(screen.getByText(explanation)).not.toBeInTheDocument();
  });

  it("opens on keyboard focus after a press that never clicked", async () => {
    const screen = await renderInfoTip();
    const button = screen.getByRole("button", {
      name: "About the reward rate",
    });
    const other = screen.getByRole("button", { name: "Return focus" });

    // Pressed, then released off the button: no click.
    await userEvent.dragAndDrop(button, other);
    await expect.element(button).toHaveAttribute("aria-expanded", "false");

    await userEvent.tab({ shift: true });
    await userEvent.tab();
    await expect.element(button).toHaveFocus();
    await expect.element(button).toHaveAttribute("aria-expanded", "true");
    await expect.element(screen.getByText(explanation)).toBeVisible();
  });
});
