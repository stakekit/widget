import { HttpResponse, http } from "msw";
import { userEvent } from "vitest/browser";

import {
  encodeYieldRewardRateFixture,
  yieldApiCampaignDtoFixture,
  yieldApiCampaignPayoutDtoFixture,
  yieldApiCampaignRewardsDtoFixture,
  yieldApiValidatorFixture,
  yieldBalanceFixture,
} from "../../fixtures";
import { yieldApiRoute } from "../../mocks/api-routes";
import { projectCampaignsHandler } from "../../mocks/campaigns";
import { mockDelay } from "../../mocks/delay";
import { describe, expect, it, type TestWorker } from "../../utils/test-extend";
import { renderApp } from "../../utils/test-utils";
import { setup } from "./trust-incentive-apy/setup";

const campaignId = "8f4f5c3a-1d2b-4c3e-9f00-2a7b6c5d4e01";
const usda = {
  name: "USDA",
  symbol: "USDA",
  decimals: 18,
  network: "avalanche-c",
  coinGeckoId: "angle-usd",
  logoURI: "https://assets.stakek.it/tokens/usda.svg",
} as const;

type Rewards = Readonly<Record<string, unknown>> | "fail" | "hang";

/**
 * A wallet with a deposit in a Trust vault that runs a campaign, its unpaid
 * rewards as a campaign `locked` balance, and `rewards` as the wallet's
 * rewards in it: an object, a failing request, or one that never answers.
 */
const campaignSetup = async (
  worker: TestWorker,
  {
    rewards,
    payouts = 7,
  }: { readonly rewards: Rewards; readonly payouts?: number }
) => {
  const base = await setup(worker);
  // Every read fails, retries included, until the test lets them through.
  let rewardsFail = rewards === "fail";

  worker.use(
    projectCampaignsHandler([
      yieldApiCampaignDtoFixture({
        yieldId: base.yieldId,
        startTime: "2026-01-01T00:00:00.000Z",
        endTime: "2030-01-01T00:00:00.000Z",
      }),
    ]),
    http.post(yieldApiRoute("/v1/yields/balances"), async () => {
      await mockDelay();
      return HttpResponse.json({
        items: [
          {
            yieldId: base.yieldId,
            balances: [
              yieldBalanceFixture({
                address: base.account,
                type: "active",
                amount: "25000",
                amountRaw: "25000000000000000000000",
                amountUsd: "25000",
                token: usda,
                pendingActions: [],
              }),
              yieldBalanceFixture({
                address: base.account,
                type: "locked",
                amount: "2.52",
                amountRaw: "2520000000000000000",
                amountUsd: "2.52",
                token: usda,
                pendingActions: [],
                campaignId,
              }),
            ],
            rewardRate: encodeYieldRewardRateFixture(
              base.personalizedRewardRate
            ),
          },
        ],
        errors: [],
      });
    }),
    http.get(yieldApiRoute("/v1/campaigns/rewards"), async () => {
      if (rewards === "hang") return new Promise<never>(() => {});
      await mockDelay();
      if (rewardsFail) {
        return HttpResponse.json({ message: "down" }, { status: 500 });
      }
      return HttpResponse.json({
        items: [
          yieldApiCampaignRewardsDtoFixture({
            yieldId: base.yieldId,
            ...(rewards === "fail" ? {} : rewards),
          }),
        ],
      });
    }),
    http.get(
      yieldApiRoute("/v1/campaigns/:campaignId/payouts"),
      async ({ request }) => {
        await mockDelay();
        const url = new URL(request.url);
        const offset = Number(url.searchParams.get("offset"));
        const limit = Number(url.searchParams.get("limit"));
        const all = Array.from({ length: payouts }, (_, index) =>
          index === 0
            ? yieldApiCampaignPayoutDtoFixture({
                status: "pending",
                paidAt: null,
                txHash: null,
              })
            : yieldApiCampaignPayoutDtoFixture({
                paidAt: `2026-12-${String(14 - index).padStart(2, "0")}T12:04:00.000Z`,
              })
        );
        return HttpResponse.json({
          items: all.slice(offset, offset + limit),
          limit,
          offset,
          total: payouts,
        });
      }
    )
  );
  base.setUrl({ accountId: base.account });

  return {
    base,
    /** Renders the widget with the wallet connected, on the Manage tab. */
    openPositions: async ({
      dashboard = true,
    }: { readonly dashboard?: boolean } = {}) => {
      const app = await renderApp({
        walletListFactory: base.customConnectors,
        skProps: {
          apiKey: import.meta.env.VITE_API_KEY,
          ...(dashboard ? { dashboardVariant: true } : {}),
        },
      });
      await userEvent.click(
        app.getByRole("tab", { name: "Manage", exact: true })
      );
      return app;
    },
    /** Lets the wallet's rewards load from now on. */
    recoverRewards: () => {
      rewardsFail = false;
    },
  };
};

const qualification = (
  status: string,
  qualifyingBalance: string,
  incentivizedBalance: string
) => ({ qualification: { status, qualifyingBalance, incentivizedBalance } });

describe("Campaign rewards on positions", () => {
  it("shows what a position earned, in the list and in its details", async ({
    worker,
  }) => {
    const { openPositions } = await campaignSetup(worker, { rewards: {} });
    const app = await openPositions();

    const row = app.getByRole("link", { name: /Trust USDA Earn/ });
    await expect
      .element(row.getByText("Campaign", { exact: true }))
      .toBeVisible();
    await expect
      .element(row.getByText("Campaign rewards earned"))
      .toBeVisible();
    await expect.element(row.getByText("80.39 USDA")).toBeVisible();
    // Unpaid campaign rewards pay out on their own: nothing to unlock.
    await expect.element(row.getByText("Locked")).not.toBeInTheDocument();

    await userEvent.click(row);

    const section = app.getByTestId("campaign-rewards");
    await expect
      .element(
        app.getByTestId("campaign-rewards__earned").getByText("80.39 USDA")
      )
      .toBeVisible();
    await expect
      .element(
        app.getByTestId("campaign-rewards__paid").getByText("77.87 USDA")
      )
      .toBeVisible();
    await expect
      .element(
        app.getByTestId("campaign-rewards__pending").getByText("2.52 USDA")
      )
      .toBeVisible();
    await expect
      .element(
        section.getByText(
          "Payouts are added to your position as kAllezUSDC. 77.87 USDA of your balance came from campaign rewards."
        )
      )
      .toBeVisible();
    await expect.element(section.getByText(/^Updated /)).toBeVisible();
    await expect
      .element(app.getByText("Pending campaign rewards"))
      .toBeInTheDocument();

    const payouts = app.getByTestId("campaign-rewards__payouts");
    await expect.element(payouts.getByText("Recent payouts")).toBeVisible();
    await expect
      .poll(() => payouts.getByText("+3.04 USDA").elements().length)
      .toBe(5);
    await expect.element(payouts.getByText("Pending")).toBeVisible();

    await userEvent.click(payouts.getByRole("button", { name: "Show all 7" }));
    await expect.element(payouts.getByText("All payouts (7)")).toBeVisible();
    await expect
      .poll(() => payouts.getByText("+3.04 USDA").elements().length)
      .toBe(7);

    await app.unmount();
  });

  it("says how much more a position below the minimum needs", async ({
    worker,
  }) => {
    const { openPositions } = await campaignSetup(worker, {
      rewards: {
        ...qualification("below_threshold", "6.5", "0"),
        totals: { earned: "0", paid: "0", unpaid: "0" },
        inputTokenTotals: { earned: "0", paid: "0", unpaid: "0" },
      },
      payouts: 0,
    });
    const app = await openPositions();
    await userEvent.click(app.getByText("Trust USDA Earn").first());

    const notice = app.getByTestId("campaign-rewards__notice-below-minimum");
    await expect
      .element(notice.getByText("Not earning campaign rewards yet"))
      .toBeVisible();
    await expect
      .element(
        notice.getByText(
          "Deposit 3.5 USDA more to start earning. Campaign rewards need at least 10 USDA in this position."
        )
      )
      .toBeVisible();
    // Nothing earned and nothing to earn yet: no empty totals.
    await expect
      .element(app.getByTestId("campaign-rewards__earned"))
      .not.toBeInTheDocument();
    await expect.element(app.getByText(/^No payouts yet\./)).toBeVisible();

    await app.unmount();
  });

  it("explains the part of a position over the per-wallet cap", async ({
    worker,
  }) => {
    const { openPositions } = await campaignSetup(worker, {
      rewards: qualification("qualified", "82000", "50000"),
    });
    const app = await openPositions();
    await userEvent.click(app.getByText("Trust USDA Earn").first());

    await expect
      .element(
        app
          .getByTestId("campaign-rewards__notice-over-cap")
          .getByText(
            "Only the first 50,000 USDA earns campaign rewards. The other 32,000 USDA still earns this yield's own rate."
          )
      )
      .toBeVisible();
    await expect
      .element(app.getByTestId("campaign-rewards__earned"))
      .toBeVisible();

    await app.unmount();
  });

  it("tells an excluded wallet neutrally, without a reason", async ({
    worker,
  }) => {
    const { openPositions } = await campaignSetup(worker, {
      rewards: qualification("not_eligible", "25000", "0"),
    });
    const app = await openPositions();
    await userEvent.click(app.getByText("Trust USDA Earn").first());

    const notice = app.getByTestId("campaign-rewards__notice-not-eligible");
    await expect
      .element(notice.getByText("Not earning campaign rewards"))
      .toBeVisible();
    await expect
      .element(
        notice.getByText(
          "This wallet isn't earning campaign rewards. If you think this is a mistake, contact support."
        )
      )
      .toBeVisible();
    expect(app.getByText(/blacklist/i).query()).toBeNull();

    await app.unmount();
  });

  it("badges a position split by validator without repeating its earned total", async ({
    worker,
  }) => {
    const { openPositions, base } = await campaignSetup(worker, {
      rewards: {},
    });
    worker.use(
      http.post(yieldApiRoute("/v1/yields/balances"), async () => {
        await mockDelay();
        return HttpResponse.json({
          items: [
            {
              yieldId: base.yieldId,
              balances: [
                yieldBalanceFixture({
                  address: base.account,
                  type: "active",
                  amount: "25000",
                  amountRaw: "25000000000000000000000",
                  amountUsd: "25000",
                  token: usda,
                  pendingActions: [],
                  validator: yieldApiValidatorFixture({
                    address: "0x1111111111111111111111111111111111111111",
                    name: "Validator One",
                  }),
                }),
              ],
            },
          ],
          errors: [],
        });
      })
    );
    const app = await openPositions();

    const row = app.getByRole("link", { name: /Trust USDA Earn/ });
    await expect
      .element(row.getByText("Campaign", { exact: true }))
      .toBeVisible();
    await expect
      .element(row.getByText("Campaign rewards earned"))
      .not.toBeInTheDocument();

    await app.unmount();
  });

  it("keeps the unpaid amount in view while the campaign is paused", async ({
    worker,
  }) => {
    const { openPositions } = await campaignSetup(worker, {
      rewards: { status: "paused" },
    });
    const app = await openPositions();
    await userEvent.click(app.getByRole("link", { name: /Trust USDA Earn/ }));

    const pending = app.getByTestId("campaign-rewards__pending");
    await expect.element(pending.getByText("2.52 USDA")).toBeVisible();
    await expect
      .element(pending.getByText("Paused. Earned rewards are kept"))
      .toBeVisible();

    await app.unmount();
  });

  it("keeps the final payout pending after the campaign ends", async ({
    worker,
  }) => {
    const { openPositions } = await campaignSetup(worker, {
      rewards: { status: "ended", nextPayoutDueAt: "2030-05-19T12:00:00.000Z" },
    });
    const app = await openPositions();
    await userEvent.click(app.getByText("Trust USDA Earn").first());

    const pending = app.getByTestId("campaign-rewards__pending");
    await expect.element(pending.getByText("Final payout")).toBeVisible();
    await expect.element(pending.getByText("2.52 USDA")).toBeVisible();
    await expect.element(pending.getByText(/^Due /)).toBeVisible();
    await expect
      .element(
        app
          .getByTestId("campaign-rewards__notice-final-payout")
          .getByText(
            /^This campaign has ended\. Your final payout is on its way/
          )
      )
      .toBeVisible();
    await expect
      .element(
        app.getByTestId("campaign-rewards__earned").getByText("80.39 USDA")
      )
      .toBeVisible();

    await app.unmount();
  });

  it("holds the rewards' place while they load, with the position usable", async ({
    worker,
  }) => {
    const { openPositions } = await campaignSetup(worker, {
      rewards: "hang",
    });
    const app = await openPositions();
    await userEvent.click(app.getByText("Trust USDA Earn").first());

    await expect
      .element(app.getByTestId("campaign-rewards__loading"))
      .toBeVisible();
    await expect
      .element(app.getByRole("textbox", { name: "Amount" }))
      .toBeInTheDocument();

    await app.unmount();
  });

  it("reassures when rewards can't load, and loads them on retry", async ({
    worker,
  }) => {
    const { openPositions, recoverRewards } = await campaignSetup(worker, {
      rewards: "fail",
    });
    const app = await openPositions();
    await userEvent.click(app.getByText("Trust USDA Earn").first());

    const unavailable = app.getByTestId("campaign-rewards__unavailable");
    await expect
      .element(
        unavailable.getByText(
          "Campaign rewards can't be loaded right now. Your rewards are safe and keep building up."
        )
      )
      .toBeVisible();
    await expect
      .element(app.getByRole("textbox", { name: "Amount" }))
      .toBeInTheDocument();

    recoverRewards();
    await userEvent.click(
      unavailable.getByRole("button", { name: "Try again" })
    );

    await expect
      .element(
        app.getByTestId("campaign-rewards__earned").getByText("80.39 USDA")
      )
      .toBeVisible();

    await app.unmount();
  });

  it("shows the rewards in the compact Layout too", async ({ worker }) => {
    const { openPositions } = await campaignSetup(worker, { rewards: {} });
    const app = await openPositions({ dashboard: false });

    await expect
      .element(app.getByText("Campaign rewards earned"))
      .toBeVisible();
    await userEvent.click(app.getByText("Trust USDA Earn").first());
    await expect
      .element(
        app.getByTestId("campaign-rewards__earned").getByText("80.39 USDA")
      )
      .toBeVisible();

    await app.unmount();
  });
});
