import { HttpResponse, http } from "msw";
import { page } from "vitest/browser";

import {
  yieldApiActionDtoFixture,
  yieldApiTransactionDtoFixture,
} from "../../fixtures";
import { yieldApiRoute } from "../../mocks/api-routes";
import { mockWalletListFactory } from "../../utils/mock-connector";
import { describe, expect, it } from "../../utils/test-extend";
import { renderApp } from "../../utils/test-utils";

const account = "0x0000000000000000000000000000000000000001";

const completedStake = yieldApiActionDtoFixture({
  address: account,
  amount: "1.25",
  amountUsd: "3000",
  completedAt: "2026-01-02T10:05:00.000Z",
  createdAt: "2026-01-02T10:00:00.000Z",
  id: "completed-stake",
  status: "SUCCESS",
  transactions: [
    yieldApiTransactionDtoFixture({
      broadcastedAt: "2026-01-02T10:01:00.000Z",
      createdAt: "2026-01-02T10:00:00.000Z",
      explorerUrl: "https://explorer.test/stake",
      hash: "0x03fa9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7ee314",
      status: "CONFIRMED",
      type: "STAKE",
    }),
  ],
  type: "STAKE",
});

const failedUnstake = yieldApiActionDtoFixture({
  address: account,
  amount: "123456.789",
  createdAt: "2026-01-01T10:00:00.000Z",
  id: "failed-unstake",
  status: "FAILED",
  type: "UNSTAKE",
});

const rowsOf = (container: HTMLElement) =>
  Array.from(
    container.querySelectorAll<HTMLElement>(
      '[data-testid^="activity-list-item"]'
    )
  );

describe("Activity in the compact Widget", () => {
  it("lists two-line rows and opens a receipt under a single back button, without tabs", async ({
    worker,
  }) => {
    await page.viewport(400, 900);
    worker.use(
      http.get(yieldApiRoute("/v1/actions"), () =>
        HttpResponse.json({
          items: [completedStake, failedUnstake],
          limit: 20,
          offset: 0,
          total: 2,
        })
      )
    );
    const app = await renderApp({
      walletListFactory: mockWalletListFactory({ accounts: [account] }),
    });

    await app.getByRole("tab", { name: "Activity" }).click();
    await expect.poll(() => rowsOf(app.container).length).toBe(2);
    const rows = rowsOf(app.container);
    expect(
      new Set(rows.map((row) => row.getBoundingClientRect().height)).size
    ).toBe(1);
    for (const row of rows) {
      expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
    }
    expect(rows[0]?.textContent).not.toContain("Completed");
    expect(rows[1]?.textContent).toContain("Failed");

    await app.getByText("Deposited ETH").click();
    await expect
      .element(app.getByRole("heading", { name: "Deposited ETH" }))
      .toBeVisible();

    await expect
      .element(app.getByRole("button", { name: /back/i }))
      .toBeVisible();
    expect(
      app.container.querySelectorAll('button[aria-label*="Back" i]')
    ).toHaveLength(1);
    await expect.element(app.getByText("$3,000.00")).toBeVisible();
    await expect
      .element(app.getByRole("button", { name: "View on explorer" }))
      .toBeVisible();
    const hash = app.getByText("0x03fa…e314").element();
    expect(hash.getBoundingClientRect().height).toBeLessThan(
      Number.parseFloat(getComputedStyle(hash).lineHeight) * 1.5
    );
    expect(app.container.querySelector('[role="tablist"]')).toBeNull();

    await app.getByRole("button", { name: /back/i }).click();
    await expect.poll(() => rowsOf(app.container).length).toBe(2);
    await expect.element(app.getByRole("tablist")).toBeVisible();
    await expect
      .element(app.getByRole("tab", { name: "Activity", selected: true }))
      .toBeVisible();

    await app.unmount();
  });
});
