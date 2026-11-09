import { HttpResponse, http } from "msw";
import { page, userEvent } from "vitest/browser";
import {
  borrowWalletAddress,
  makeBorrowAccountSnapshotDto,
  makeBorrowCollateralTokenDto,
  makeBorrowIntegrationDto,
  makeBorrowMarketDto,
  makeBorrowSupplyBalanceDto,
} from "../../../fixtures/borrow";
import { borrowApiRoute, legacyApiRoute } from "../../../mocks/api-routes";
import { mockWalletListFactory } from "../../../utils/mock-connector";
import {
  describe,
  expect,
  it,
  type TestWorker,
} from "../../../utils/test-extend";
import { renderApp } from "../../../utils/test-utils";

const account = borrowWalletAddress;

const integration = makeBorrowIntegrationDto();

const market = makeBorrowMarketDto();

const emptyPosition = makeBorrowAccountSnapshotDto({
  availableToBorrowUsd: "0",
  currentLtv: "0",
  debtBalances: [],
  healthFactor: null,
  netApy: "0",
  netWorthUsd: "0",
  totalBorrowedUsd: "0",
});

const transaction = {
  address: account,
  chainId: "1",
  id: "borrow-transaction",
  network: "ethereum",
  status: "BROADCASTED",
  type: "BORROW",
} as const;

const action = {
  action: "borrow",
  address: account,
  createdAt: "2026-01-01T00:00:00.000Z",
  currentStep: 1,
  hasNextStep: false,
  id: "borrow-action",
  integrationId: integration.id,
  status: "CREATED",
  totalSteps: 1,
  transactions: [transaction],
} as const;

// $400 of USDC debt behind 0.5 WETH ($1,000) of collateral: 40% LTV, 2.125 HF.
const existingPosition = makeBorrowAccountSnapshotDto({
  supplyBalances: [
    makeBorrowSupplyBalanceDto({
      positionState: {
        availableToBorrowUsd: "450",
        currentLtv: "0.4",
        healthFactor: "2.125",
        liquidationThreshold: "0.85",
      },
    }),
  ],
  totalCollateralUsd: "1000",
  totalSuppliedUsd: "1000",
});

/** Borrow in the stacked Dashboard, below its two-column width. */
const renderBorrowEntryAt900 = async (
  worker: TestWorker,
  position: typeof existingPosition
) => {
  worker.use(
    http.get(borrowApiRoute("/v1/positions"), () =>
      HttpResponse.json(position)
    ),
    http.get(borrowApiRoute("/v1/integrations"), () =>
      HttpResponse.json([integration])
    ),
    http.get(borrowApiRoute("/v1/markets"), () =>
      HttpResponse.json({ items: [market], limit: 100, offset: 0, total: 1 })
    )
  );
  await page.viewport(900, 1000);
  const app = await renderApp({
    walletListFactory: mockWalletListFactory({ accounts: [account] }),
    skProps: {
      apiKey: import.meta.env.VITE_API_KEY,
      borrowEnabled: true,
      layout: "dashboard",
    },
  });
  await userEvent.click(app.getByText("Borrow"));
  await expect.element(app.getByText("Borrow APY")).toBeInTheDocument();
  return app;
};

describe("Borrow Entry flow details", () => {
  it("projects the LTV and health factor of an existing position in the stacked Dashboard", async ({
    worker,
  }) => {
    const app = await renderBorrowEntryAt900(worker, existingPosition);

    await expect
      .element(app.getByText("2.12", { exact: true }))
      .toBeInTheDocument();
    await expect
      .element(app.getByText("40%", { exact: true }))
      .toBeInTheDocument();

    await app.unmount();
    await page.viewport(800, 900);
  });

  it("shows placeholders and says why when the position can't be projected", async ({
    worker,
  }) => {
    // The account's collateral total disagrees with its collateral balances.
    const app = await renderBorrowEntryAt900(worker, {
      ...existingPosition,
      totalCollateralUsd: "1500",
    });

    await expect
      .element(
        app.getByText(
          "We couldn't compute the LTV and health factor from this position's data."
        )
      )
      .toBeInTheDocument();
    await expect.element(app.getByText("Health factor")).toBeInTheDocument();

    await app.unmount();
    await page.viewport(800, 900);
  });

  it("keeps describing the started market after the catalog drops it", async ({
    worker,
  }) => {
    let marketRequests = 0;

    worker.use(
      http.get(
        legacyApiRoute("/v2/networks/:network/addresses/:address/tokens"),
        () =>
          HttpResponse.json([
            {
              token: {
                ...makeBorrowCollateralTokenDto().token,
                network: "ethereum",
              },
              amount: "1",
              availableYields: [],
            },
          ])
      ),
      http.get(borrowApiRoute("/v1/positions"), () =>
        HttpResponse.json(emptyPosition)
      ),
      http.get(borrowApiRoute("/v1/integrations"), () =>
        HttpResponse.json([integration])
      ),
      http.get(borrowApiRoute("/v1/markets"), () => {
        marketRequests += 1;
        // The refresh after confirmation reports the market drained below the
        // listing threshold, so the catalog stops listing it.
        const items =
          marketRequests === 1
            ? [market]
            : [
                {
                  ...market,
                  availableLiquidity: "1",
                  availableLiquidityRaw: "1000000",
                },
              ];
        return HttpResponse.json({
          items,
          limit: 100,
          offset: 0,
          total: items.length,
        });
      }),
      http.post(borrowApiRoute("/v1/actions"), () => HttpResponse.json(action)),
      http.get(borrowApiRoute(`/v1/actions/${action.id}`), () =>
        HttpResponse.json({
          ...action,
          status: "SUCCESS",
          transactions: [{ ...transaction, status: "CONFIRMED" }],
        })
      )
    );

    const app = await renderApp({
      walletListFactory: mockWalletListFactory({ accounts: [account] }),
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        borrowEnabled: true,
        dashboardVariant: true,
      },
    });

    await userEvent.click(app.getByText("Borrow"));
    await expect.element(app.getByText("Borrow APY")).toBeInTheDocument();
    await userEvent.click(app.getByTestId("number-input").last());
    await userEvent.keyboard("0.5");
    await userEvent.click(app.getByTestId("number-input").first());
    await userEvent.keyboard("25");
    await app.getByRole("button", { name: "Review borrow" }).click();
    await app.getByRole("button", { name: "Confirm" }).click();

    await expect
      .poll(
        () =>
          app.container.querySelector('[data-rk="borrow-complete-page"]') !==
          null
      )
      .toBe(true);
    await expect.poll(() => marketRequests).toBeGreaterThanOrEqual(2);

    // The pane follows the live entry for the started market, not the reset
    // entry form.
    await expect.element(app.getByText("1 USDC")).toBeInTheDocument();
    await expect
      .element(app.getByText("Select a borrow market"))
      .not.toBeInTheDocument();

    await app.unmount();
  });
});
