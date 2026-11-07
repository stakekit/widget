import { HttpResponse, http } from "msw";
import { page, userEvent } from "vitest/browser";
import { borrowApiRoute, legacyApiRoute } from "../../../mocks/api-routes";
import { mockWalletListFactory } from "../../../utils/mock-connector";
import {
  describe,
  expect,
  it,
  type TestWorker,
} from "../../../utils/test-extend";
import { renderApp } from "../../../utils/test-utils";

const account = "0x0000000000000000000000000000000000000001";

const integration = {
  id: "aave-borrow",
  providerId: "aave",
  name: "Aave V3",
  networks: ["ethereum"],
  metadata: {
    description: "Aave lending and borrowing",
    externalLink: "https://aave.com",
    logoURI: "https://assets.stakek.it/protocols/aave.svg",
  },
  actions: [],
} as const;

const weth = {
  address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  symbol: "WETH",
  name: "Wrapped Ether",
  decimals: 18,
} as const;

const market = {
  id: "aave-v3-ethereum-usdc",
  integrationId: integration.id,
  network: "ethereum",
  type: "pool",
  poolAddress: "0x0000000000000000000000000000000000000001",
  loanToken: {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  collateralTokens: [
    {
      token: weth,
      priceUsd: "2000",
      maxLtv: "0.8",
      liquidationThreshold: "0.85",
      liquidationPenalty: "0.05",
      supplyRate: "0.02",
    },
  ],
  borrowRate: "0.06",
  totalSupply: "1000000",
  totalSupplyRaw: "1000000000000",
  totalBorrow: "500000",
  totalBorrowRaw: "500000000000",
  availableLiquidity: "500000",
  availableLiquidityRaw: "500000000000",
  utilizationRate: "0.5",
  loanTokenPriceUsd: "1",
  isBorrowEnabled: true,
  supplyCollateralFeeBps: "0",
  feeWrapperAddress: null,
  originationFeeBps: "0",
  originationFeeWrapperAddress: null,
  blueBundleOriginationFeeBps: null,
  minLoan: null,
} as const;

const emptyPosition = {
  address: account,
  availableToBorrowUsd: "0",
  currentLtv: "0",
  debtBalances: [],
  healthFactor: null,
  integrationId: integration.id,
  netApy: "0",
  netWorthUsd: "0",
  network: "ethereum",
  supplyBalances: [],
  totalBorrowedUsd: "0",
  totalCollateralUsd: "0",
  totalSuppliedUsd: "0",
} as const;

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
const existingPosition = {
  ...emptyPosition,
  availableToBorrowUsd: "450",
  currentLtv: "0.4",
  debtBalances: [
    {
      apy: "0.06",
      balance: "400",
      balanceRaw: "400000000",
      balanceUsd: "400",
      marketId: market.id,
      pendingActions: [],
      tokenAddress: market.loanToken.address,
      tokenSymbol: "USDC",
    },
  ],
  healthFactor: "2.125",
  netApy: "-0.006",
  netWorthUsd: "600",
  supplyBalances: [
    {
      apy: "0.02",
      balance: "0.5",
      balanceRaw: "500000000000000000",
      balanceUsd: "1000",
      isCollateral: true,
      marketId: market.id,
      pendingActions: [],
      positionState: {
        availableToBorrowUsd: "450",
        currentLtv: "0.4",
        healthFactor: "2.125",
        liquidationThreshold: "0.85",
      },
      tokenAddress: weth.address,
      tokenSymbol: "WETH",
    },
  ],
  totalBorrowedUsd: "400",
  totalCollateralUsd: "1000",
  totalSuppliedUsd: "1000",
};

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
              token: { ...weth, network: "ethereum" },
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
