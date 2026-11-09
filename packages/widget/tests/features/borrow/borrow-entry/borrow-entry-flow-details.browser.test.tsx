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
import {
  borrowApiRoute,
  legacyApiRoute,
  yieldApiRoute,
} from "../../../mocks/api-routes";
import { mockDelay } from "../../../mocks/delay";
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

const wbtcCollateral = makeBorrowCollateralTokenDto({
  liquidationThreshold: "0.8",
  maxLtv: "0.75",
  priceUsd: "60000",
  supplyRate: "0.015",
  token: {
    address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    decimals: 8,
    name: "Wrapped Bitcoin",
    symbol: "WBTC",
  },
});

const daiMarket = makeBorrowMarketDto({
  availableLiquidity: "375000",
  availableLiquidityRaw: "375000000000000000000000",
  borrowRate: "0.04",
  id: "aave-v3-ethereum-dai",
  loanToken: {
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    decimals: 18,
    name: "Dai Stablecoin",
    symbol: "DAI",
  },
  poolAddress: "0x0000000000000000000000000000000000000002",
  totalBorrow: "125000",
  totalBorrowRaw: "125000000000000000000000",
  totalSupply: "500000",
  totalSupplyRaw: "500000000000000000000000",
  utilizationRate: "0.25",
});

describe("Borrow dashboard tab", () => {
  it("opens the native Borrow entry with its collateral and market sheets", async ({
    worker,
  }) => {
    const tokenBalanceRequestSignals: AbortSignal[] = [];
    const yieldBalanceRequestSignals: AbortSignal[] = [];

    worker.use(
      http.get(
        legacyApiRoute("/v2/networks/:network/addresses/:address/tokens"),
        async ({ request }) => {
          tokenBalanceRequestSignals.push(request.signal);
          await mockDelay();
          return HttpResponse.json([]);
        }
      ),
      http.post(yieldApiRoute("/v1/yields/balances"), async ({ request }) => {
        yieldBalanceRequestSignals.push(request.signal);
        await mockDelay();
        return HttpResponse.json({ items: [], errors: [] });
      }),
      http.get(borrowApiRoute("/v1/positions"), () =>
        HttpResponse.json(emptyPosition)
      ),
      http.get(borrowApiRoute("/v1/integrations"), () =>
        HttpResponse.json([integration])
      ),
      http.get(borrowApiRoute("/v1/markets"), () => {
        const items = [
          makeBorrowMarketDto({
            collateralTokens: [makeBorrowCollateralTokenDto(), wbtcCollateral],
          }),
          daiMarket,
        ];
        return HttpResponse.json({
          items,
          limit: 100,
          offset: 0,
          total: items.length,
        });
      })
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
    await expect.element(app.getByText("Market stats")).toBeInTheDocument();
    // Without amounts the LTV row stays, as a placeholder.
    await expect.element(app.getByText("LTV ratio")).toBeInTheDocument();
    await expect
      .poll(() => tokenBalanceRequestSignals.length)
      .toBeGreaterThanOrEqual(1);
    await expect
      .poll(() => yieldBalanceRequestSignals.length)
      .toBeGreaterThanOrEqual(1);

    await app.getByTestId("borrow-collateral-select").click();
    await expect
      .element(app.getByText("Select collateral"))
      .toBeInTheDocument();
    await app
      .getByTestId("select-modal__container")
      .getByTestId(
        "borrow-collateral-select__item_0x2260fac5e5542a773aa44fbcfedf7c193bc2c599"
      )
      .click();
    await expect.element(app.getByText("WBTC / USDC")).toBeInTheDocument();
    await expect
      .element(app.getByTestId("borrow-collateral-select"))
      .toMatchTextContent("WBTC");

    await app.getByTestId("borrow-market-select").click();
    await expect
      .element(app.getByText("Select borrow market"))
      .toBeInTheDocument();
    await app
      .getByTestId("select-modal__container")
      .getByTestId("borrow-market-select__item_aave-v3-ethereum-dai")
      .click();
    await expect.element(app.getByText("WETH / DAI")).toBeInTheDocument();
    await expect
      .element(app.getByTestId("borrow-market-select"))
      .toMatchTextContent("DAI");

    await userEvent.click(app.getByTestId("number-input").last());
    await userEvent.keyboard("1");
    await expect
      .element(app.getByText("Amount exceeds wallet balance."))
      .toBeInTheDocument();
    await expect
      .element(app.getByTestId("number-input").last())
      .toHaveAttribute("aria-invalid", "true");
    expect(app.container.textContent).not.toContain("3M");
    expect(tokenBalanceRequestSignals.every((signal) => !signal.aborted)).toBe(
      true
    );
    expect(yieldBalanceRequestSignals.every((signal) => !signal.aborted)).toBe(
      true
    );

    await app.unmount();
  });

  it("opens a supply-only action for collateral alone and reviews a borrow", async ({
    worker,
  }) => {
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
      http.get(borrowApiRoute("/v1/markets"), () =>
        HttpResponse.json({ items: [market], limit: 100, offset: 0, total: 1 })
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
    // Collateral alone opens a supply-only action.
    await expect
      .element(app.getByRole("button", { name: "Review supply" }))
      .toBeEnabled();

    await userEvent.click(app.getByTestId("number-input").first());
    await userEvent.keyboard("25");
    await app.getByRole("button", { name: "Review borrow" }).click();

    await expect.element(app.getByText("Borrow USDC")).toBeInTheDocument();
    await expect.element(app.getByText("25 USDC")).toBeInTheDocument();
    await expect.element(app.getByText("0.5 WETH")).toBeInTheDocument();
    expect(app.container.textContent).not.toContain("aave-v3-ethereum-usdc");

    await app.unmount();
  });
});
