import { page } from "vitest/browser";
import { describe, expect, it } from "../../utils/test-extend";
import { renderApp } from "../../utils/test-utils";

// The least height of the details pane, which otherwise takes the form's.
const detailsPaneMinHeight = 620;

describe("Dashboard Layout height", () => {
  it("bounds the details pane by the form and scrolls it", async () => {
    await page.viewport(1280, 1000);
    const app = await renderApp({
      skProps: { apiKey: import.meta.env.VITE_API_KEY, layout: "dashboard" },
    });

    const cta = app.getByRole("button", { name: "Connect wallet" });
    await expect.element(cta).toBeEnabled();
    const details = app.getByRole("region", { name: "Details" });
    await expect.element(details).toBeVisible();
    const region = details.element();

    // The details overflow the pane rather than growing the Dashboard.
    await expect
      .poll(() => region.scrollHeight > region.clientHeight)
      .toBe(true);

    const pane = region.getBoundingClientRect();
    expect(pane.height).toBeGreaterThanOrEqual(detailsPaneMinHeight);
    // The call-to-action sits at the foot of the form's column, level with
    // the foot of the details pane.
    expect(
      Math.abs(cta.element().getBoundingClientRect().bottom - pane.bottom)
    ).toBeLessThan(1);

    const root = app.container.querySelector("[data-sk-root]");
    expect(root?.getBoundingClientRect().height).toBeLessThan(1000);

    await app.unmount();
  });
});
