import { HttpResponse, http } from "msw";

import { YieldCategory } from "../../../src/public-api/types";
import { yieldApiYieldDtoFixture } from "../../fixtures";
import { yieldApiRoute } from "../../mocks/api-routes";
import { mockDelay } from "../../mocks/delay";
import { describe, expect, it } from "../../utils/test-extend";
import { renderApp } from "../../utils/test-utils";

const yieldCategoryYieldsHandler = () => {
  const stakeYield = yieldApiYieldDtoFixture({
    id: "ethereum-eth-native-staking",
  });
  const defiYield = yieldApiYieldDtoFixture({
    id: "ethereum-usdc-lending",
    mechanics: {
      ...stakeYield.mechanics,
      type: "lending",
    },
  });
  const rwaYield = yieldApiYieldDtoFixture({
    id: "ethereum-usdc-real-world-asset",
    mechanics: {
      ...stakeYield.mechanics,
      type: "real_world_asset",
    },
  });

  return http.get(yieldApiRoute("/v1/yields"), async () => {
    await mockDelay();

    const items = [stakeYield, defiYield, rwaYield];

    return HttpResponse.json({
      items,
      total: items.length,
      offset: 0,
      limit: items.length,
    });
  });
};

describe("Renders initial page", () => {
  it("uses category dashboard yield grouping by default with Borrow disabled", async ({
    worker,
  }) => {
    worker.use(yieldCategoryYieldsHandler());

    const app = await renderApp({
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        dashboardVariant: true,
      },
    });

    await expect.element(app.getByText("Stake")).toBeInTheDocument();
    await expect.element(app.getByText("DeFi")).toBeInTheDocument();
    await expect.element(app.getByText("RWA")).toBeInTheDocument();
    await expect.element(app.getByText("Manage")).toBeInTheDocument();
    await expect.element(app.getByText("Activity")).toBeInTheDocument();

    const tabsSection = app.container.querySelector("[data-rk='tabs-section']");
    const tabsText = tabsSection?.textContent ?? "";

    expect(tabsText).toContain("Stake");
    expect(tabsText).toContain("DeFi");
    expect(tabsText).toContain("RWA");
    expect(tabsText).not.toContain("Borrow");
    expect(tabsText).not.toContain("Earn");

    await app.unmount();
  });

  it("supports flat dashboard yield grouping with Borrow disabled", async () => {
    const app = await renderApp({
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        dashboardVariant: true,
        yieldGrouping: "flat",
      },
    });

    const tabsSection = app.container.querySelector("[data-rk='tabs-section']");
    const tabsText = tabsSection?.textContent ?? "";

    expect(tabsText).toContain("Earn");
    expect(tabsText).not.toContain("Borrow");
    expect(tabsText).toContain("Manage");
    expect(tabsText).toContain("Activity");

    await app.unmount();
  });

  it("uses the configured dashboard category tab order", async ({ worker }) => {
    worker.use(yieldCategoryYieldsHandler());

    const app = await renderApp({
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        borrowEnabled: true,
        dashboardVariant: true,
        yieldCategoryOrder: [
          YieldCategory.Stake,
          YieldCategory.DeFi,
          YieldCategory.RWA,
        ],
      },
    });

    await expect
      .element(app.getByText("Stake", { exact: true }))
      .toBeInTheDocument();
    await expect
      .element(app.getByText("DeFi", { exact: true }))
      .toBeInTheDocument();
    await expect
      .element(app.getByText("RWA", { exact: true }))
      .toBeInTheDocument();
    await expect
      .element(app.getByText("Borrow", { exact: true }))
      .toBeInTheDocument();
    await expect
      .element(app.getByText("Manage", { exact: true }))
      .toBeInTheDocument();
    await expect
      .element(app.getByText("Activity", { exact: true }))
      .toBeInTheDocument();

    const tabsSection = app.container.querySelector("[data-rk='tabs-section']");
    const tabsText = tabsSection?.textContent ?? "";

    expect(tabsText.indexOf("Stake")).toBeLessThan(tabsText.indexOf("DeFi"));
    expect(tabsText.indexOf("DeFi")).toBeLessThan(tabsText.indexOf("RWA"));
    expect(tabsText.indexOf("RWA")).toBeLessThan(tabsText.indexOf("Borrow"));
    expect(tabsText.indexOf("Borrow")).toBeLessThan(tabsText.indexOf("Manage"));
    expect(tabsText.indexOf("Manage")).toBeLessThan(
      tabsText.indexOf("Activity")
    );

    await app.unmount();
  });

  it("updates the selected dashboard category after route tab changes", async ({
    worker,
  }) => {
    worker.use(yieldCategoryYieldsHandler());

    const app = await renderApp({
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        borrowEnabled: true,
        dashboardVariant: true,
      },
    });
    const tab = (label: string) =>
      app.getByRole("tab", { name: label, exact: true });
    const clickTab = (label: string) => tab(label).click();

    // DeFi leads the default order and opens selected.
    await expect.element(tab("DeFi")).toHaveAttribute("aria-selected", "true");
    const tabsText =
      app.container.querySelector("[data-rk='tabs-section']")?.textContent ??
      "";
    expect(tabsText.indexOf("DeFi")).toBeLessThan(tabsText.indexOf("Stake"));
    expect(tabsText.indexOf("Stake")).toBeLessThan(tabsText.indexOf("RWA"));

    await clickTab("RWA");
    await expect.element(tab("RWA")).toHaveAttribute("aria-selected", "true");
    await expect.element(tab("DeFi")).toHaveAttribute("aria-selected", "false");

    await clickTab("Borrow");
    await expect
      .element(tab("Borrow"))
      .toHaveAttribute("aria-selected", "true");

    await clickTab("Stake");
    await expect.element(tab("Stake")).toHaveAttribute("aria-selected", "true");

    await clickTab("Manage");
    await expect
      .element(tab("Manage"))
      .toHaveAttribute("aria-selected", "true");

    await clickTab("DeFi");
    await expect.element(tab("DeFi")).toHaveAttribute("aria-selected", "true");

    await clickTab("Activity");
    await expect
      .element(tab("Activity"))
      .toHaveAttribute("aria-selected", "true");

    await clickTab("RWA");
    await expect.element(tab("RWA")).toHaveAttribute("aria-selected", "true");

    await app.unmount();
  });
});
