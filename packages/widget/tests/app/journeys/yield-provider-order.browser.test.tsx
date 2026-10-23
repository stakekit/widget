import { HttpResponse, http } from "msw";
import { YieldProviderId } from "../../../src/public-api/types";
import { yieldApiYieldDtoFixture } from "../../fixtures";
import { legacyApiRoute, yieldApiRoute } from "../../mocks/api-routes";
import { mockDelay } from "../../mocks/delay";
import { describe, expect, it } from "../../utils/test-extend";
import { renderApp } from "../../utils/test-utils";

const baseYield = yieldApiYieldDtoFixture();
const defiYield = ({
  id,
  providerId,
  total,
  type,
}: {
  readonly id: string;
  readonly providerId: string;
  readonly total: number;
  readonly type: "lending" | "vault";
}) =>
  yieldApiYieldDtoFixture({
    id,
    mechanics: { ...baseYield.mechanics, type },
    providerId,
    rewardRate: { components: [], rateType: "APY", total },
  });
const yields = [
  defiYield({
    id: "ethereum-eth-aave-lending",
    providerId: YieldProviderId.Aave,
    total: 0.05,
    type: "lending",
  }),
  defiYield({
    id: "ethereum-eth-upshift-vault",
    providerId: YieldProviderId.Upshift,
    total: 0.06,
    type: "vault",
  }),
  defiYield({
    id: "ethereum-eth-morpho-vault",
    providerId: YieldProviderId.Morpho,
    total: 0.03,
    type: "vault",
  }),
];

const defiCatalogHandlers = () => [
  http.get(yieldApiRoute("/v1/yields"), async () => {
    await mockDelay();
    return HttpResponse.json({
      items: yields,
      limit: yields.length,
      offset: 0,
      total: yields.length,
    });
  }),
  http.get(legacyApiRoute("/v1/tokens"), async ({ request }) => {
    await mockDelay();
    const yieldTypes = new URL(request.url).searchParams
      .getAll("yieldTypes")
      .flatMap((value) => value.split(","));
    return HttpResponse.json(
      yieldTypes.length === 0 || yieldTypes.includes("lending")
        ? [
            {
              availableYields: yields.map(({ id }) => id),
              token: baseYield.token,
            },
          ]
        : []
    );
  }),
];

type App = Awaited<ReturnType<typeof renderApp>>;

const listedYieldIds = async (app: App) => {
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
  await expect.poll(() => ids().length).toBe(yields.length);
  return ids();
};

describe("Yield Provider Order", () => {
  it("leads the DeFi tab with the host's ranked provider", async ({
    worker,
  }) => {
    worker.use(...defiCatalogHandlers());

    const app = await renderApp({
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        dashboardVariant: true,
        yieldProviderOrder: { defi: [YieldProviderId.Morpho] },
      },
    });

    await expect
      .element(app.getByText("DeFi", { exact: true }))
      .toHaveAttribute("data-state", "selected");
    await expect(listedYieldIds(app)).resolves.toEqual([
      "ethereum-eth-morpho-vault",
      "ethereum-eth-upshift-vault",
      "ethereum-eth-aave-lending",
    ]);
    await expect
      .element(
        app.getByTestId(/^select-opportunity__item_ethereum-eth-morpho-vault/)
      )
      .toHaveAttribute("data-selected", "true");

    await app.unmount();
  });

  it("ignores the ranking when yields are listed flat", async ({ worker }) => {
    worker.use(...defiCatalogHandlers());

    const app = await renderApp({
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        dashboardVariant: true,
        yieldGrouping: "flat",
        yieldProviderOrder: { defi: [YieldProviderId.Morpho] },
      },
    });

    await expect(listedYieldIds(app)).resolves.toEqual([
      "ethereum-eth-aave-lending",
      "ethereum-eth-upshift-vault",
      "ethereum-eth-morpho-vault",
    ]);
    await expect
      .element(
        app.getByTestId(/^select-opportunity__item_ethereum-eth-aave-lending/)
      )
      .toHaveAttribute("data-selected", "true");

    await app.unmount();
  });
});
