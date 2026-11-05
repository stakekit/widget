import { HelpModal } from "../../../src/index.package";
import { describe, expect, it } from "../../utils/test-extend";
import { renderApp } from "../../utils/test-utils";

describe("HelpModal as SKApp children", () => {
  it("themes the trigger and popup while the trigger flows in the host's footer", async () => {
    const app = await renderApp({
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
    // The dark default `background` role.
    expect(getComputedStyle(dialog.element()).backgroundColor).toBe(
      "rgb(21, 21, 23)"
    );

    await app.unmount();
  });
});
