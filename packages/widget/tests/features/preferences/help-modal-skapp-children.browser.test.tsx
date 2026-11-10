import { userEvent } from "vitest/browser";

import { HelpModal } from "../../../src/index.package";
import { describe, expect, it } from "../../utils/test-extend";
import { renderApp } from "../../utils/test-utils";

/** A host footer row with a `gap`, the HelpModal's trigger between links. */
const renderFooter = () =>
  renderApp({
    skProps: {
      apiKey: import.meta.env.VITE_API_KEY,
      appearance: { colorScheme: "dark" },
      children: (
        <footer
          data-testid="host-footer"
          style={{ alignItems: "center", display: "flex", gap: 8 }}
        >
          <span data-testid="terms">Terms</span>
          <HelpModal modal={{ type: "whatIsStakeKit" }} />
          <span data-testid="privacy">Privacy</span>
        </footer>
      ),
    },
  });

describe("HelpModal as SKApp children", () => {
  it("themes and translates the popup while the trigger flows in the host's footer", async () => {
    const app = await renderFooter();

    const footer = app.getByTestId("host-footer");
    const trigger = footer.getByRole("button");
    await expect.element(trigger).toBeVisible();
    const triggerBox = trigger.element().getBoundingClientRect();
    const termsBox = app.getByTestId("terms").element().getBoundingClientRect();
    const privacyBox = app
      .getByTestId("privacy")
      .element()
      .getBoundingClientRect();
    // The theme root adds no box: the trigger keeps its width in the row.
    expect(triggerBox.width).toBeGreaterThan(0);
    expect(triggerBox.left).toBeGreaterThanOrEqual(termsBox.right);
    expect(privacyBox.left).toBeGreaterThanOrEqual(triggerBox.right);
    expect(trigger.element().closest("[data-sk-root]")).not.toBeNull();

    await trigger.click();

    const dialog = app.getByRole("dialog");
    await expect.element(dialog).toBeVisible();
    expect(dialog.element().closest("[data-sk-portal]")).not.toBeNull();
    expect(footer.element().contains(dialog.element())).toBe(true);
    // Translated though it renders outside the Widget's frame, while the
    // host chrome beside it stays mounted.
    await expect
      .element(dialog.getByRole("heading", { name: "What is Yield.xyz?" }))
      .toBeVisible();
    await expect.element(app.getByTestId("terms")).toHaveTextContent("Terms");
    // The popup paints the same `background` role as the Widget's frame.
    const frame = app.container.querySelector("[data-rk='widget-container']");
    if (frame === null) throw new Error("The Widget frame is missing.");
    expect(getComputedStyle(dialog.element()).backgroundColor).toBe(
      getComputedStyle(frame).backgroundColor
    );

    await app.unmount();
  });

  it("opens and closes without moving the host's footer items, focusing the dialog", async () => {
    const app = await renderFooter();

    const trigger = app.getByTestId("host-footer").getByRole("button");
    await expect.element(trigger).toBeVisible();
    const privacy = app.getByTestId("privacy").element();
    const privacyLeft = privacy.getBoundingClientRect().left;

    await trigger.click();

    const dialog = app.getByRole("dialog");
    await expect.element(dialog).toBeVisible();
    // The open popup adds no item to the host's row, so no gap moves the
    // links after the trigger.
    expect(privacy.getBoundingClientRect().left).toBe(privacyLeft);
    // Opened with the mouse, the dialog itself takes focus, so the close
    // button shows no focus ring.
    expect(document.activeElement).toBe(dialog.element());

    await userEvent.keyboard("{Escape}");

    await expect.element(dialog).not.toBeInTheDocument();
    expect(privacy.getBoundingClientRect().left).toBe(privacyLeft);

    await app.unmount();
  });
});
