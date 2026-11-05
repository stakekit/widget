import { HttpResponse, http } from "msw";
import { page } from "vitest/browser";
import { yieldApiActionDtoFixture } from "../../fixtures";
import { yieldApiRoute } from "../../mocks/api-routes";
import { mockWalletListFactory } from "../../utils/mock-connector";
import { describe, expect, it } from "../../utils/test-extend";
import { renderApp } from "../../utils/test-utils";

// The least height of the details pane, which otherwise takes the form's.
const detailsPaneMinHeight = 620;

const account = "0x0000000000000000000000000000000000000001";

/**
 * The frame's page area: in the frame's content, the block between the
 * header and the brand footer.
 */
const pageAreaOf = (container: HTMLElement) => {
  const content = container.querySelector(
    '[data-rk="widget-container"]'
  )?.firstElementChild;
  const area = content?.children.item(content.children.length - 2);
  if (!(area instanceof HTMLElement)) throw new Error("No page area");
  return area;
};

/** How far a pane stops short of the bottom of the page area's content box. */
const gapToFoot = (pane: Element, area: HTMLElement) => {
  const style = getComputedStyle(area);
  const foot =
    area.getBoundingClientRect().bottom -
    Number.parseFloat(style.paddingBottom) -
    Number.parseFloat(style.borderBottomWidth);
  return Math.abs(foot - pane.getBoundingClientRect().bottom);
};

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

  it("stacks the details under the form at a 900px width", async () => {
    await page.viewport(900, 1000);
    const app = await renderApp({
      skProps: { apiKey: import.meta.env.VITE_API_KEY, layout: "dashboard" },
    });

    const cta = app.getByRole("button", { name: "Connect wallet" });
    await expect.element(cta).toBeEnabled();
    const details = app.getByRole("region", { name: "Details" });
    await expect.element(details).toBeVisible();

    const form = cta.element().getBoundingClientRect();
    const pane = details.element().getBoundingClientRect();
    // One column: the details start below the form, as wide as it.
    expect(pane.top).toBeGreaterThanOrEqual(form.bottom);
    expect(pane.left).toBe(form.left);
    expect(pane.width).toBeGreaterThanOrEqual(form.width);
    // Nothing overflows the stacked pane: it keeps its content's height.
    const region = details.element();
    expect(region.scrollHeight).toBeLessThanOrEqual(region.clientHeight + 1);

    await app.unmount();
  });

  // The frame's minimum height is taller than these pages' own: the panes
  // grow into the rest of it rather than leaving an empty band at its foot.
  it("grows the Activity list and receipt to the foot of the page area", async ({
    worker,
  }) => {
    await page.viewport(1280, 1000);
    worker.use(
      http.get(yieldApiRoute("/v1/actions"), () =>
        HttpResponse.json({
          items: Array.from({ length: 12 }, (_, index) =>
            yieldApiActionDtoFixture({
              address: account,
              createdAt: `2026-01-${String(index + 1).padStart(2, "0")}T10:00:00.000Z`,
              id: `stake-${index}`,
              status: "SUCCESS",
              type: "STAKE",
            })
          ),
          limit: 20,
          offset: 0,
          total: 12,
        })
      )
    );
    const app = await renderApp({
      skProps: { apiKey: import.meta.env.VITE_API_KEY, layout: "dashboard" },
      walletListFactory: mockWalletListFactory({ accounts: [account] }),
    });

    await app.getByRole("tab", { name: "Activity" }).click();
    const receipt = app.getByTestId("activity-details-receipt");
    await expect.element(receipt).toBeVisible();
    const list = app.getByRole("region", { name: "Activity" }).element();
    const area = pageAreaOf(app.container);

    await expect
      .poll(() => gapToFoot(receipt.element(), area))
      .toBeLessThanOrEqual(1);
    expect(gapToFoot(list, area)).toBeLessThanOrEqual(1);
    // Past its cap, its rows still scroll within it.
    expect(list.getBoundingClientRect().height).toBeGreaterThan(480);
    expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);

    await app.unmount();
  });

  it("grows the Earn panes to the foot of the page area", async () => {
    await page.viewport(1280, 1000);
    const app = await renderApp({
      skProps: { apiKey: import.meta.env.VITE_API_KEY, layout: "dashboard" },
    });

    const cta = app.getByRole("button", { name: "Connect wallet" });
    await expect.element(cta).toBeEnabled();
    const details = app.getByRole("region", { name: "Details" });
    await expect.element(details).toBeVisible();

    const area = pageAreaOf(app.container);
    expect(gapToFoot(details.element(), area)).toBeLessThanOrEqual(1);
    expect(gapToFoot(cta.element(), area)).toBeLessThanOrEqual(1);

    await app.unmount();
  });
});
