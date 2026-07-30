import { HttpResponse, http } from "msw";
import { userEvent } from "vitest/browser";
import type { BorrowAccountSnapshot } from "../../src/domain/borrow/positions/borrow-account-snapshot";
import { borrowApiRoute } from "../mocks/api-routes";
import { rkMockWallet } from "../utils/mock-connector";
import { describe, expect, it } from "../utils/test-extend";
import { renderApp } from "../utils/test-utils";

const account = "0x0000000000000000000000000000000000000001";

type PositionDto = typeof BorrowAccountSnapshot.Encoded;

const integration = {
  id: "aave-borrow",
  providerId: "aave",
  name: "Aave V3 Borrow",
  networks: ["ethereum"],
  metadata: {
    description: "Aave lending and borrowing",
    externalLink: "https://aave.com",
    logoURI: "https://assets.stakek.it/protocols/aave.svg",
  },
  actions: [],
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
      token: {
        address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        symbol: "WETH",
        name: "Wrapped Ether",
        decimals: 18,
      },
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
  minLoan: null,
} as const;

const position: PositionDto = {
  address: account,
  availableToBorrowUsd: "450",
  currentLtv: "0.4",
  debtBalances: [
    {
      apy: "0.06",
      balance: "400",
      balanceRaw: "400000000",
      balanceUsd: "400",
      marketId: market.id,
      pendingActions: [
        {
          args: {
            marketId: market.id,
            tokenAddress: market.loanToken.address,
          },
          label: "Repay",
          type: "repay",
        },
      ],
      tokenAddress: market.loanToken.address,
      tokenSymbol: "USDC",
    },
  ],
  healthFactor: "2.125",
  integrationId: integration.id,
  netApy: "-0.006",
  netWorthUsd: "600",
  network: "ethereum",
  supplyBalances: [
    {
      apy: "0.02",
      balance: "0.5",
      balanceRaw: "500000000000000000",
      balanceUsd: "1000",
      isCollateral: true,
      marketId: market.id,
      pendingActions: [
        {
          args: {
            amountRaw: "500000000000000000",
            marketId: market.id,
            tokenAddress: market.collateralTokens[0].token.address,
          },
          label: "Withdraw",
          type: "withdraw",
        },
        {
          args: {
            marketId: market.id,
            tokenAddress: market.collateralTokens[0].token.address,
          },
          label: "Disable collateral",
          type: "disableCollateral",
        },
      ],
      positionState: {
        availableToBorrowUsd: "450",
        currentLtv: "0.4",
        healthFactor: "2.125",
        liquidationThreshold: "0.85",
      },
      tokenAddress: market.collateralTokens[0].token.address,
      tokenSymbol: "WETH",
    },
  ],
  totalBorrowedUsd: "400",
  totalCollateralUsd: "1000",
  totalSuppliedUsd: "1000",
};

const emptyPosition: PositionDto = {
  ...position,
  availableToBorrowUsd: "0",
  currentLtv: "0",
  debtBalances: [],
  healthFactor: null,
  netApy: "0",
  netWorthUsd: "0",
  supplyBalances: [],
  totalBorrowedUsd: "0",
  totalCollateralUsd: "0",
  totalSuppliedUsd: "0",
};

describe("Borrow position details", () => {
  it("warns without blocking when withdraw risk is unavailable", async ({
    worker,
  }) => {
    worker.use(
      http.get(borrowApiRoute("/v1/integrations"), () =>
        HttpResponse.json([integration])
      ),
      http.get(borrowApiRoute("/v1/markets"), () =>
        HttpResponse.json({
          items: [market],
          limit: 100,
          offset: 0,
          total: 1,
        })
      ),
      http.get(borrowApiRoute("/v1/positions"), () =>
        HttpResponse.json({
          ...position,
          supplyBalances: position.supplyBalances.map((supplyBalance) => ({
            ...supplyBalance,
            balanceUsd: "0",
          })),
          totalCollateralUsd: "0",
          totalSuppliedUsd: "0",
        })
      )
    );

    const app = await renderApp({
      wagmi: {
        __customConnectors__: rkMockWallet({ accounts: [account] }),
      },
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        borrowEnabled: true,
        dashboardVariant: true,
      },
    });

    await userEvent.click(app.getByText("Manage"));
    await userEvent.click(app.getByText("WETH/USDC"));
    await app.getByTestId("borrow-position-action__withdraw").click();
    await userEvent.click(app.getByTestId("number-input"));
    await userEvent.keyboard("0.1");

    await expect
      .element(app.getByText("Projected risk unavailable"))
      .toBeInTheDocument();
    await expect
      .element(
        app.getByText(
          /Risk information is unavailable for this collateral combination/
        )
      )
      .toBeInTheDocument();
    await expect
      .element(app.getByRole("button", { name: "Review borrow" }))
      .toBeEnabled();

    await app.unmount();
  });

  it("does not present market liquidity or collateral APY as user capacity", async ({
    worker,
  }) => {
    const marketWithCollateralChoices = {
      ...market,
      collateralTokens: [
        market.collateralTokens[0],
        {
          ...market.collateralTokens[0],
          supplyRate: "0.03",
          token: {
            address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
            decimals: 8,
            name: "Wrapped Bitcoin",
            symbol: "WBTC",
          },
        },
      ],
    };
    const usdtMarket = {
      ...marketWithCollateralChoices,
      id: "aave-v3-ethereum-usdt",
      loanToken: {
        address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        decimals: 6,
        name: "Tether USD",
        symbol: "USDT",
      },
    };

    worker.use(
      http.get(borrowApiRoute("/v1/integrations"), () =>
        HttpResponse.json([integration])
      ),
      http.get(borrowApiRoute("/v1/markets"), () =>
        HttpResponse.json({
          items: [marketWithCollateralChoices, usdtMarket],
          limit: 100,
          offset: 0,
          total: 2,
        })
      ),
      http.get(borrowApiRoute("/v1/positions"), () =>
        HttpResponse.json(emptyPosition)
      )
    );

    const app = await renderApp({
      wagmi: {
        __customConnectors__: rkMockWallet({ accounts: [account] }),
      },
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        borrowEnabled: true,
        dashboardVariant: true,
      },
    });

    await userEvent.click(app.getByText("Borrow"));
    await expect.element(app.getByText("Borrow APY")).toBeInTheDocument();
    expect(app.getByText("Supply APY").length).toBe(0);

    const borrowSection = app.container.querySelector(
      '[data-rk="borrow-amount-section"]'
    );
    expect(borrowSection?.textContent).not.toContain("available");
    expect(borrowSection?.textContent).not.toContain("Max");

    await app.getByTestId("borrow-market-select").click();
    await app.getByTestId("borrow-market-select__group_usdc").click();
    expect(app.container.textContent).not.toContain("Max:");
    await app
      .getByTestId(
        `borrow-market-select__item_${marketWithCollateralChoices.id}`
      )
      .click();

    await app.getByTestId("borrow-collateral-select").click();
    expect(app.container.textContent).not.toContain("2%");
    expect(app.container.textContent).not.toContain("3%");

    await app.unmount();
  });

  it("renders borrow positions in Manage and opens borrow details", async ({
    worker,
  }) => {
    worker.use(
      http.get(borrowApiRoute("/v1/integrations"), () =>
        HttpResponse.json([integration])
      ),
      http.get(borrowApiRoute("/v1/markets"), () =>
        HttpResponse.json({
          items: [market],
          limit: 100,
          offset: 0,
          total: 1,
        })
      ),
      http.get(borrowApiRoute("/v1/positions"), () =>
        HttpResponse.json(position)
      )
    );

    const app = await renderApp({
      wagmi: {
        __customConnectors__: rkMockWallet({ accounts: [account] }),
      },
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        borrowEnabled: true,
        dashboardVariant: true,
      },
    });

    await userEvent.click(app.getByText("Manage"));

    await expect.element(app.getByText("Total supplied")).toBeInTheDocument();
    await expect.element(app.getByText("Net worth")).toBeInTheDocument();
    await expect.element(app.getByText("WETH/USDC")).toBeInTheDocument();
    await expect.element(app.getByText("Aave V3")).toBeInTheDocument();

    await userEvent.click(app.getByText("WETH/USDC"));

    await expect.element(app.getByText("Borrow details")).toBeInTheDocument();
    await expect.element(app.getByText("Health factor")).toBeInTheDocument();
    await expect.element(app.getByText("2.125")).toBeInTheDocument();
    await expect.element(app.getByText("Loan to value")).toBeInTheDocument();
    await expect.element(app.getByText("Collateral value")).toBeInTheDocument();
    await expect.element(app.getByText("Borrow APY")).toBeInTheDocument();
    expect(app.container.textContent).toContain("Ethereum");
    expect(app.container.textContent).toContain("$400.00");
    await expect
      .element(app.getByTestId("borrow-position-action__repay"))
      .toBeInTheDocument();
    await expect
      .element(app.getByTestId("borrow-position-action__withdraw"))
      .toBeInTheDocument();
    await expect
      .element(app.getByTestId("borrow-position-action__disableCollateral"))
      .toBeInTheDocument();

    await app.getByTestId("borrow-position-action__withdraw").click();

    await expect
      .element(app.getByText("0.5 WETH withdrawable"))
      .toBeInTheDocument();
    await expect.element(app.getByText("Borrow details")).toBeInTheDocument();

    await userEvent.click(app.getByTestId("number-input"));
    await userEvent.keyboard("0.1");
    await app.getByRole("button", { name: "Review borrow" }).click();

    await expect.element(app.getByText("Review borrow")).toBeInTheDocument();
    await expect
      .element(app.getByRole("button", { name: "Back to position" }))
      .toBeInTheDocument();

    const backToPosition = app.container.querySelector<HTMLButtonElement>(
      '[aria-label="Back to position"]'
    );
    expect(backToPosition).not.toBeNull();
    await expect.element(app.getByText("Borrow details")).toBeInTheDocument();

    backToPosition!.click();

    await expect.element(app.getByText("Actions")).toBeInTheDocument();

    const breadcrumbBack = app.container.querySelector<HTMLButtonElement>(
      '[data-testid="borrow-position-details-back"]'
    );

    expect(breadcrumbBack).not.toBeNull();

    breadcrumbBack!.click();

    await expect.element(app.getByText("My positions")).toBeInTheDocument();
    await expect.element(app.getByText("Total supplied")).toBeInTheDocument();

    await app.unmount();
  });

  it("keeps a position execution route mounted while its position refreshes", async ({
    worker,
  }) => {
    let positionRequests = 0;
    let releasePositionRefresh!: () => void;
    let releaseActionStatus!: () => void;
    const positionRefresh = new Promise<void>((resolve) => {
      releasePositionRefresh = resolve;
    });
    const actionStatus = new Promise<void>((resolve) => {
      releaseActionStatus = resolve;
    });
    const transaction = {
      address: account,
      chainId: "1",
      id: "withdraw-transaction",
      network: "ethereum",
      status: "BROADCASTED",
      type: "WITHDRAW",
    } as const;
    const action = {
      action: "withdraw",
      address: account,
      createdAt: "2026-01-01T00:00:00.000Z",
      currentStep: 1,
      hasNextStep: false,
      id: "withdraw-action",
      integrationId: integration.id,
      status: "CREATED",
      totalSteps: 1,
      transactions: [transaction],
    } as const;

    worker.use(
      http.get(borrowApiRoute("/v1/integrations"), () =>
        HttpResponse.json([integration])
      ),
      http.get(borrowApiRoute("/v1/markets"), () =>
        HttpResponse.json({
          items: [market],
          limit: 100,
          offset: 0,
          total: 1,
        })
      ),
      http.get(borrowApiRoute("/v1/positions"), async () => {
        positionRequests += 1;
        if (positionRequests === 1) {
          return HttpResponse.json(position);
        }
        if (positionRequests === 2) {
          await positionRefresh;
        }
        return HttpResponse.json(emptyPosition);
      }),
      http.post(borrowApiRoute("/v1/actions"), () => HttpResponse.json(action)),
      http.get(borrowApiRoute(`/v1/actions/${action.id}`), async () => {
        await actionStatus;
        return HttpResponse.json({
          ...action,
          status: "SUCCESS",
          transactions: [{ ...transaction, status: "CONFIRMED" }],
        });
      })
    );

    const app = await renderApp({
      wagmi: {
        __customConnectors__: rkMockWallet({ accounts: [account] }),
      },
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        borrowEnabled: true,
        dashboardVariant: true,
      },
    });

    await userEvent.click(app.getByText("Manage"));
    await userEvent.click(app.getByText("WETH/USDC"));
    await app.getByTestId("borrow-position-action__withdraw").click();
    await userEvent.click(app.getByTestId("number-input"));
    await userEvent.keyboard("0.1");
    await app.getByRole("button", { name: "Review borrow" }).click();
    await app.getByRole("button", { name: "Confirm" }).click();

    await expect
      .poll(
        () =>
          app.container.querySelector('[data-rk="borrow-steps-page"]') !== null
      )
      .toBe(true);

    releaseActionStatus();
    await expect
      .poll(() => positionRequests, { timeout: 5_000 })
      .toBeGreaterThanOrEqual(2);
    await expect
      .poll(
        () =>
          app.container.querySelector('[data-rk="borrow-complete-page"]') !==
          null
      )
      .toBe(true);

    releasePositionRefresh();
    await expect.element(app.getByText("Something went wrong")).toBeVisible();
    await expect
      .poll(
        () =>
          app.container.querySelector('[data-rk="borrow-complete-page"]') !==
          null
      )
      .toBe(true);

    await app.unmount();
  });
});
