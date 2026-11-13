import { DateTime, Effect } from "effect";
import { HttpResponse, http } from "msw";

import {
  yieldApiCampaignDtoFixture,
  yieldApiYieldDtoFixture,
} from "../../fixtures";
import type { YieldDto } from "../../generated/yield-api-types";
import { legacyApiRoute, yieldApiRoute } from "../../mocks/api-routes";
import { projectCampaignsHandler } from "../../mocks/campaigns";
import { mockDelay } from "../../mocks/delay";
import { describe, expect, it } from "../../utils/test-extend";
import { renderApp } from "../../utils/test-utils";

const baseYield = yieldApiYieldDtoFixture();
const campaignYieldId = "ethereum-eth-kamino-allez-vault";
const plainYieldId = "ethereum-eth-kamino-main-vault";

const vault = (
  id: string,
  name: string,
  campaignRate: number | null,
  token: YieldDto["token"] = baseYield.token
) =>
  yieldApiYieldDtoFixture({
    id,
    token,
    mechanics: { ...baseYield.mechanics, type: "vault" },
    metadata: { ...baseYield.metadata, name },
    rewardRate: {
      rateType: "APY",
      total: 0.058 + (campaignRate ?? 0),
      components: [
        {
          rate: 0.058,
          rateType: "APY",
          token: baseYield.token,
          yieldSource: "vault",
        },
        ...(campaignRate === null
          ? []
          : [
              {
                rate: campaignRate,
                rateType: "APR" as const,
                token: baseYield.token,
                yieldSource: "campaign_incentive" as const,
              },
            ]),
      ],
    },
  });

// The campaign's schedule is far from the test run, so its lifecycle holds.
const liveCampaign = yieldApiCampaignDtoFixture({
  yieldId: campaignYieldId,
  startTime: "2026-01-01T00:00:00.000Z",
  endTime: "2030-01-01T00:00:00.000Z",
});

const catalogHandlers = ({
  yields,
  campaigns,
}: {
  readonly yields: ReadonlyArray<YieldDto>;
  readonly campaigns: ReadonlyArray<Readonly<Record<string, unknown>>>;
}) => [
  http.get(yieldApiRoute("/v1/yields"), async () => {
    await mockDelay();
    return HttpResponse.json({
      items: yields,
      limit: yields.length,
      offset: 0,
      total: yields.length,
    });
  }),
  http.get(yieldApiRoute("/v1/yields/:yieldId"), async ({ params }) => {
    await mockDelay();
    const found = yields.find(({ id }) => id === params.yieldId);
    return found
      ? HttpResponse.json(found)
      : HttpResponse.json({ message: "Not found" }, { status: 404 });
  }),
  http.get(legacyApiRoute("/v1/tokens"), async () => {
    await mockDelay();
    // One entry per token, listing the yields it enters.
    const tokens = new Map<string, YieldDto["token"]>(
      yields.map(({ token }) => [`${token.network}:${token.symbol}`, token])
    );
    return HttpResponse.json(
      [...tokens].map(([key, token]) => ({
        availableYields: yields
          .filter(
            (item) => `${item.token.network}:${item.token.symbol}` === key
          )
          .map(({ id }) => id),
        token,
      }))
    );
  }),
  projectCampaignsHandler(campaigns),
];

type App = Awaited<ReturnType<typeof renderApp>>;

const listedYieldIds = async (app: App, count: number) => {
  await app.getByTestId("select-opportunity").click();
  const ids = () =>
    [
      ...app.container.ownerDocument.querySelectorAll(
        "[data-testid^='select-opportunity__item_']"
      ),
    ].map((element) =>
      element
        .getAttribute("data-testid")
        ?.replace(/^select-opportunity__item_/, "")
        .replace(/-\d+$/, "")
    );
  await expect.poll(() => ids().length).toBe(count);
  return ids();
};

describe("Campaigns on Earn", () => {
  it("explains a running campaign on the selected yield", async ({
    worker,
  }) => {
    worker.use(
      ...catalogHandlers({
        yields: [vault(campaignYieldId, "Allez USDC Vault", 0.042)],
        campaigns: [liveCampaign],
      })
    );

    const app = await renderApp();

    const strip = app.getByTestId("campaign-strip");
    await expect.element(strip.getByText("Campaign")).toBeVisible();
    await expect.element(strip.getByText(/^Ends [^·]+$/)).toBeVisible();
    const campaignRow = app.getByTestId("reward-rate-breakdown__campaign");
    await expect.element(campaignRow.getByText("Campaign APR")).toBeVisible();
    await expect.element(campaignRow.getByText("Up to 4.20%")).toBeVisible();
    const totalRow = app.getByTestId("reward-rate-breakdown__total");
    await expect.element(totalRow.getByText("Total APY")).toBeVisible();
    // The campaign part is the most a wallet earns, so the total is too.
    await expect.element(totalRow.getByText("Up to 10.00%")).toBeVisible();
    const campaignNote = app.getByText(
      /^Extra campaign rewards, paid daily into your position until /
    );
    await expect.element(campaignNote).toBeVisible();
    // The campaign's note leads the yield's notes.
    expect(
      campaignNote.element().closest("footer")?.firstElementChild?.textContent
    ).toMatch(/^Extra campaign rewards/);

    await campaignRow
      .getByRole("button", { name: "About the campaign rate" })
      .click();
    await expect.element(app.getByText("Campaign rate")).toBeVisible();
    await expect.element(app.getByText("+4.20%")).toBeVisible();
    await expect
      .element(app.getByTestId("campaign-rates__total").getByText("10.00%"))
      .toBeVisible();
    // The tip sums the rate up, without the campaign's name.
    await expect
      .element(app.getByText("Kamino × Utila USDC Boost"))
      .not.toBeInTheDocument();
    // The details live in the Campaign section, collapsed under the Earn card
    // until the tip or the strip asks for them; no dialog opens.
    const section = app.getByTestId("campaign-section");
    const toggle = app.getByTestId("campaign-section__toggle");
    await expect.element(section).not.toBeInTheDocument();
    await app.getByRole("button", { name: "View campaign details" }).click();

    await expect
      .element(section.getByText("Kamino × Utila USDC Boost"))
      .toBeVisible();
    await expect
      .element(
        section.getByTestId("campaign-rates__campaign").getByText("+4.20%")
      )
      .toBeVisible();
    await expect
      .element(section.getByText("Daily, added to your position"))
      .toBeVisible();
    await expect
      .element(section.getByText("Minimum balance"))
      .not.toBeInTheDocument();
    await expect.element(toggle).toHaveFocus();
    await expect.element(app.getByRole("dialog")).not.toBeInTheDocument();

    // Closed again, the strip's Details opens it the same way.
    await toggle.click();
    await expect.element(section).not.toBeInTheDocument();
    await strip.getByRole("button", { name: "Details" }).click();
    await expect.element(section).toBeVisible();
    await expect.element(toggle).toHaveFocus();

    await app.unmount();
  });

  it("badges and pins the campaign yield with its rate, and offers it above another yield", async ({
    worker,
  }) => {
    worker.use(
      ...catalogHandlers({
        yields: [
          vault(plainYieldId, "USDC Main Market", null),
          vault(campaignYieldId, "Allez USDC Vault", 0.042),
        ],
        campaigns: [liveCampaign],
      })
    );

    const app = await renderApp();

    const offer = app.getByTestId("campaign-offer");
    await expect
      .element(
        offer.getByText(/^Allez USDC Vault has a campaign: up to 10\.00%\./)
      )
      .toBeVisible();
    await expect
      .element(app.getByTestId("campaign-strip"))
      .not.toBeInTheDocument();

    await expect(listedYieldIds(app, 2)).resolves.toEqual([
      campaignYieldId,
      plainYieldId,
    ]);
    const campaignOption = app.getByTestId(
      new RegExp(`^select-opportunity__item_${campaignYieldId}`)
    );
    await expect.element(campaignOption.getByText("Campaign")).toBeVisible();
    await expect
      .element(campaignOption.getByText("+4.20% campaign"))
      .toBeVisible();
    await app
      .getByTestId("select-modal__container")
      .getByRole("button", { name: "Close" })
      .click();

    await offer.getByRole("button", { name: "Switch" }).click();

    await expect.element(app.getByTestId("campaign-strip")).toBeVisible();
    await expect
      .element(app.getByTestId("campaign-offer"))
      .not.toBeInTheDocument();

    await app.unmount();
  });

  it("offers the catalog's first running campaign on the network, and switches to its token", async ({
    worker,
  }) => {
    const usdt = {
      ...baseYield.token,
      symbol: "USDT",
      name: "Tether USD",
      address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
    };
    const otherNetworkYieldId = "polygon-usdc-allez-vault";
    worker.use(
      ...catalogHandlers({
        yields: [
          vault(plainYieldId, "USDC Main Market", null),
          vault(otherNetworkYieldId, "Polygon USDC Vault", 0.05, {
            ...baseYield.token,
            network: "polygon",
          }),
          vault(campaignYieldId, "Allez USDT Vault", 0.042, usdt),
        ],
        campaigns: [
          { ...liveCampaign, id: "polygon", yieldId: otherNetworkYieldId },
          liveCampaign,
        ],
      })
    );

    const app = await renderApp();

    // The first campaign earns on another network, so the next one is offered.
    const offer = app.getByTestId("campaign-offer");
    await expect
      .element(
        offer.getByText(/^Allez USDT Vault has a campaign: up to 10\.00%\./)
      )
      .toBeVisible();

    await offer.getByRole("button", { name: "Switch" }).click();

    await expect.element(app.getByTestId("campaign-strip")).toBeVisible();
    await expect
      .element(app.getByTestId("select-token").getByText("USDT"))
      .toBeVisible();
    await expect
      .element(app.getByTestId("campaign-offer"))
      .not.toBeInTheDocument();

    await app.unmount();
  });

  it("offers the running campaign at the top of the Dashboard's Earn page", async ({
    worker,
  }) => {
    worker.use(
      ...catalogHandlers({
        yields: [
          vault(plainYieldId, "USDC Main Market", null),
          vault(campaignYieldId, "Allez USDC Vault", 0.042),
        ],
        campaigns: [liveCampaign],
      })
    );

    const app = await renderApp({
      skProps: { apiKey: import.meta.env.VITE_API_KEY, dashboardVariant: true },
    });

    const offer = app.getByTestId("campaign-offer");
    await expect
      .element(
        offer.getByText(/^Allez USDC Vault has a campaign: up to 10\.00%\./)
      )
      .toBeVisible();

    await offer.getByRole("button", { name: "Switch" }).click();

    await expect.element(app.getByTestId("campaign-section")).toBeVisible();
    await expect
      .element(app.getByTestId("campaign-offer"))
      .not.toBeInTheDocument();

    await app.unmount();
  });

  it("keeps a paused campaign visible without its rate", async ({ worker }) => {
    worker.use(
      ...catalogHandlers({
        yields: [vault(campaignYieldId, "Allez USDC Vault", null)],
        campaigns: [{ ...liveCampaign, status: "paused" }],
      })
    );

    const app = await renderApp();

    const strip = app.getByTestId("campaign-strip");
    await expect.element(strip.getByText(/^Paused · ends /)).toBeVisible();
    await expect
      .element(
        strip.getByText("Rewards are paused. Rewards you've earned are kept.")
      )
      .toBeVisible();
    await expect
      .element(
        app.getByTestId("reward-rate-breakdown__campaign").getByText("Paused")
      )
      .toBeVisible();

    await strip.getByRole("button", { name: "Details" }).click();
    await expect
      .element(
        app
          .getByTestId("campaign-section")
          .getByText(/^Paused\. No new rewards build up for now\./)
      )
      .toBeVisible();

    await app.unmount();
  });

  it("names the sponsor and links the terms", async ({ worker }) => {
    worker.use(
      ...catalogHandlers({
        yields: [vault(campaignYieldId, "Allez USDC Vault", 0.017)],
        campaigns: [
          {
            ...liveCampaign,
            sponsor: { name: "Kamino", logoURI: null },
            termsUrl: "https://example.com/kamino-terms",
          },
        ],
      })
    );

    const app = await renderApp();

    await expect
      .element(
        app.getByText(
          /^Kamino adds extra rewards, paid daily into your position/
        )
      )
      .toBeVisible();

    await app
      .getByTestId("campaign-strip")
      .getByRole("button", { name: "Details" })
      .click();

    const section = app.getByTestId("campaign-section");
    await expect.element(section.getByText("Funded by Kamino")).toBeVisible();
    await expect
      .element(section.getByRole("link", { name: /Read the campaign terms/ }))
      .toHaveAttribute("href", "https://example.com/kamino-terms");

    await app.unmount();
  });

  it("pins and badges a paused campaign's yield without offering it", async ({
    worker,
  }) => {
    worker.use(
      ...catalogHandlers({
        yields: [
          vault(plainYieldId, "USDC Main Market", null),
          vault(campaignYieldId, "Allez USDC Vault", null),
        ],
        campaigns: [{ ...liveCampaign, status: "paused" }],
      })
    );

    const app = await renderApp();

    await expect.element(app.getByTestId("select-opportunity")).toBeVisible();
    await expect(listedYieldIds(app, 2)).resolves.toEqual([
      campaignYieldId,
      plainYieldId,
    ]);
    await expect
      .element(
        app
          .getByTestId(
            new RegExp(`^select-opportunity__item_${campaignYieldId}`)
          )
          .getByText("Campaign")
      )
      .toBeVisible();
    // Only a running campaign is offered.
    await expect
      .element(app.getByTestId("campaign-offer"))
      .not.toBeInTheDocument();

    await app.unmount();
  });

  it("announces an upcoming campaign by its start date alone when it has no rate yet", async ({
    worker,
  }) => {
    worker.use(
      ...catalogHandlers({
        yields: [vault(campaignYieldId, "Allez USDC Vault", null)],
        campaigns: [
          {
            ...liveCampaign,
            rewardRate: null,
            startTime: "2030-01-01T00:00:00.000Z",
            endTime: "2030-06-01T00:00:00.000Z",
          },
        ],
      })
    );

    const app = await renderApp();

    const strip = app.getByTestId("campaign-strip");
    await expect.element(strip.getByText("Upcoming")).toBeVisible();
    await expect.element(strip.getByText(/^Starts [^·]+$/)).toBeVisible();
    await expect
      .element(
        app.getByTestId("reward-rate-breakdown__campaign").getByText(/^From /)
      )
      .toBeVisible();

    await strip.getByRole("button", { name: "Details" }).click();
    await expect
      .element(
        app
          .getByTestId("campaign-section")
          .getByText(
            /^Starts .+\. Until then you earn this yield's own rate\.$/
          )
      )
      .toBeVisible();

    await app.unmount();
  });

  it("marks a campaign ending soon by its end date alone, without a chip or a day count", async ({
    worker,
  }) => {
    // oxlint-disable-next-line effect/no-run-effect-in-test -- synchronous fixture: the schedule must end days after the real clock the widget reads
    const now = Effect.runSync(DateTime.now);
    worker.use(
      ...catalogHandlers({
        yields: [vault(campaignYieldId, "Allez USDC Vault", 0.042)],
        campaigns: [
          {
            ...liveCampaign,
            endTime: DateTime.formatIso(
              DateTime.add(now, { days: 4, hours: 12 })
            ),
          },
        ],
      })
    );

    const app = await renderApp();

    const strip = app.getByTestId("campaign-strip");
    await expect.element(strip.getByText(/^Ends [^·]+$/)).toBeVisible();

    await strip.getByRole("button", { name: "Details" }).click();
    await expect.element(app.getByTestId("campaign-section")).toBeVisible();
    await expect.element(app.getByText("Ending soon")).not.toBeInTheDocument();
    await expect
      .element(app.getByText(/\d+ days? left/))
      .not.toBeInTheDocument();

    await app.unmount();
  });

  it("shows nothing for a campaign past its end, even while the API still lists it", async ({
    worker,
  }) => {
    worker.use(
      ...catalogHandlers({
        yields: [vault(campaignYieldId, "Allez USDC Vault", null)],
        campaigns: [
          {
            ...liveCampaign,
            startTime: "2026-01-01T00:00:00.000Z",
            endTime: "2026-06-01T00:00:00.000Z",
          },
        ],
      })
    );

    const app = await renderApp({
      skProps: { apiKey: import.meta.env.VITE_API_KEY, dashboardVariant: true },
    });

    await expect
      .element(app.getByTestId("estimated-reward__percent"))
      .toBeVisible();
    await expect
      .element(app.getByTestId("campaign-strip"))
      .not.toBeInTheDocument();
    await expect
      .element(app.getByTestId("campaign-section"))
      .not.toBeInTheDocument();

    await app.unmount();
  });

  it("summarises the campaign in the Dashboard yield details", async ({
    worker,
  }) => {
    worker.use(
      ...catalogHandlers({
        yields: [vault(campaignYieldId, "Allez USDC Vault", 0.042)],
        campaigns: [liveCampaign],
      })
    );

    const app = await renderApp({
      skProps: { apiKey: import.meta.env.VITE_API_KEY, dashboardVariant: true },
    });

    await expect.element(app.getByText("Incl. +4.20% campaign")).toBeVisible();
    const section = app.getByTestId("campaign-section");
    await expect
      .element(section.getByText("Kamino × Utila USDC Boost"))
      .toBeVisible();
    // The section's schedule tells the campaign's state; no status chip.
    await expect.element(section.getByText("Live")).not.toBeInTheDocument();
    await expect
      .element(section.getByText("Daily, added to your position"))
      .toBeVisible();
    await expect
      .element(
        section.getByTestId("campaign-rates__campaign").getByText("+4.20%")
      )
      .toBeVisible();
    await expect
      .element(section.getByTestId("campaign-rates__total").getByText("10.00%"))
      .toBeVisible();

    // Closed, the strip's Details opens it again and brings it into view.
    const toggle = app.getByTestId("campaign-section__toggle");
    await toggle.click();
    await expect.element(section).not.toBeInTheDocument();
    await app
      .getByTestId("campaign-strip")
      .getByRole("button", { name: "Details" })
      .click();
    await expect.element(toggle).toHaveFocus();
    await expect.element(toggle).toBeInViewport();
    await expect.element(app.getByRole("dialog")).not.toBeInTheDocument();

    await app.unmount();
  });

  it("adds a live campaign's rate the cached yield doesn't list yet", async ({
    worker,
  }) => {
    worker.use(
      ...catalogHandlers({
        yields: [vault(campaignYieldId, "Allez USDC Vault", null)],
        campaigns: [liveCampaign],
      })
    );

    const app = await renderApp();

    await expect
      .element(
        app
          .getByTestId("reward-rate-breakdown__campaign")
          .getByText("Up to 4.20%")
      )
      .toBeVisible();
    await expect
      .element(
        app
          .getByTestId("reward-rate-breakdown__total")
          .getByText("Up to 10.00%")
      )
      .toBeVisible();

    await app.getByTestId("select-opportunity").click();
    const campaignOption = app.getByTestId(
      new RegExp(`^select-opportunity__item_${campaignYieldId}`)
    );
    await expect.element(campaignOption.getByText("10.00%")).toBeVisible();
    await expect
      .element(campaignOption.getByText("+4.20% campaign"))
      .toBeVisible();

    await app.unmount();
  });
});
