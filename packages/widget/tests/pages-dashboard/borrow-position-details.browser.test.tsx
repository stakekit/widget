import { HttpResponse, http } from "msw";
import { userEvent } from "vitest/browser";
import type { BorrowAccountSnapshot } from "../../src/domain/borrow/positions/borrow-account-snapshot";
import { borrowApiRoute } from "../mocks/api-routes";
import { mockWalletListFactory } from "../utils/mock-connector";
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
  originationFeeBps: "0",
  originationFeeWrapperAddress: null,
  blueBundleOriginationFeeBps: null,
  minLoan: null,
} as const;

const wethSupplyBalance = {
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
} satisfies PositionDto["supplyBalances"][number];

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
  supplyBalances: [wethSupplyBalance],
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
  it("omits unavailable withdraw risk without blocking review", async ({
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
      walletListFactory: mockWalletListFactory({ accounts: [account] }),
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        borrowEnabled: true,
        dashboardVariant: true,
      },
    });

    await userEvent.click(app.getByText("Manage"));
    await userEvent.click(app.getByText("WETH/USDC"));
    await expect
      .element(app.getByText("Health factor"))
      .not.toBeInTheDocument();
    await expect
      .element(app.getByText("Loan to value"))
      .not.toBeInTheDocument();
    await app.getByTestId("borrow-position-action__withdraw").click();
    await userEvent.click(app.getByTestId("number-input"));
    await userEvent.keyboard("0.6");

    await expect
      .element(app.getByText("Projected risk unavailable"))
      .not.toBeInTheDocument();
    await expect
      .element(app.getByText("Amount exceeds withdrawable balance."))
      .toBeInTheDocument();
    await expect
      .element(app.getByTestId("number-input"))
      .not.toHaveAttribute("aria-invalid", "true");
    await expect
      .element(app.getByRole("button", { name: "Review withdrawal" }))
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
      walletListFactory: mockWalletListFactory({ accounts: [account] }),
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
      walletListFactory: mockWalletListFactory({ accounts: [account] }),
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
    await expect
      .element(app.getByText("Aave V3", { exact: false }))
      .toBeInTheDocument();

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
      .not.toBeInTheDocument();
    await app.getByRole("button", { name: "Details" }).click();
    await expect
      .element(app.getByTestId("borrow-collateral-toggle__disableCollateral"))
      .toHaveAttribute("aria-checked", "true");
    await app
      .getByTestId("borrow-collateral-toggle__disableCollateral")
      .click();
    await expect
      .element(app.getByText("Disable WETH as collateral"))
      .toBeInTheDocument();
    await app.getByRole("button", { name: "Back to position" }).click();
    await expect
      .element(app.getByTestId("borrow-collateral-toggle__disableCollateral"))
      .toBeVisible();
    await app.getByRole("button", { name: "Actions" }).click();

    await app.getByTestId("borrow-position-action__withdraw").click();

    await expect
      .element(app.getByText("0.5 WETH withdrawable"))
      .toBeInTheDocument();
    await expect.element(app.getByText("Borrow details")).toBeInTheDocument();

    await userEvent.click(app.getByTestId("number-input"));
    await userEvent.keyboard("0.1");
    await app.getByRole("button", { name: "Review withdrawal" }).click();

    await expect.element(app.getByText("Withdraw WETH")).toBeInTheDocument();
    await expect
      .element(app.getByRole("button", { name: "Back to position" }))
      .toBeInTheDocument();

    await expect.element(app.getByText("Borrow details")).toBeInTheDocument();
    await app.getByRole("button", { name: "Back to position" }).click();

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

  it("keeps a pool collateral toggle review on the debt position its reserve backs", async ({
    worker,
  }) => {
    // Aave keys each balance by its own reserve, so the collateral toggle
    // targets the WETH reserve while the position lives under the USDC market.
    const collateralReserve = {
      ...market,
      id: "aave-v3-ethereum-weth",
      loanToken: market.collateralTokens[0].token,
    };
    worker.use(
      http.get(borrowApiRoute("/v1/integrations"), () =>
        HttpResponse.json([integration])
      ),
      http.get(borrowApiRoute("/v1/markets"), () =>
        HttpResponse.json({
          items: [market, collateralReserve],
          limit: 100,
          offset: 0,
          total: 2,
        })
      ),
      http.get(borrowApiRoute("/v1/positions"), () =>
        HttpResponse.json({
          ...position,
          supplyBalances: [
            {
              ...wethSupplyBalance,
              marketId: collateralReserve.id,
              pendingActions: wethSupplyBalance.pendingActions.map(
                (pendingAction) => ({
                  ...pendingAction,
                  args: {
                    ...pendingAction.args,
                    marketId: collateralReserve.id,
                  },
                })
              ),
            },
          ],
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

    await userEvent.click(app.getByText("Manage"));
    await userEvent.click(app.getByText("WETH/USDC"));
    await app.getByRole("button", { name: "Details" }).click();
    await app
      .getByTestId("borrow-collateral-toggle__disableCollateral")
      .click();

    await expect
      .element(app.getByText("Disable WETH as collateral"))
      .toBeInTheDocument();
    await expect
      .element(app.getByText("No open position in this market."))
      .not.toBeInTheDocument();

    await app.getByRole("button", { name: "Back to position" }).click();
    await expect
      .element(app.getByTestId("borrow-collateral-toggle__disableCollateral"))
      .toBeVisible();
    await expect
      .element(app.getByText("No open position in this market."))
      .not.toBeInTheDocument();

    await app.unmount();
  });

  it("lists every collateral and switches the withdrawal token from the amount field", async ({
    worker,
  }) => {
    const wbtc = {
      address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
      decimals: 8,
      name: "Wrapped Bitcoin",
      symbol: "WBTC",
    } as const;
    const twoCollateralMarket = {
      ...market,
      collateralTokens: [
        market.collateralTokens[0],
        { ...market.collateralTokens[0], priceUsd: "50000", token: wbtc },
      ],
    };
    const wbtcBalance = {
      ...wethSupplyBalance,
      balance: "0.04",
      balanceRaw: "4000000",
      balanceUsd: "2000",
      pendingActions: wethSupplyBalance.pendingActions.map((pendingAction) => ({
        ...pendingAction,
        args: {
          ...pendingAction.args,
          ...(pendingAction.type === "withdraw"
            ? { amountRaw: "4000000" }
            : {}),
          tokenAddress: wbtc.address,
        },
      })),
      tokenAddress: wbtc.address,
      tokenSymbol: wbtc.symbol,
    };

    worker.use(
      http.get(borrowApiRoute("/v1/integrations"), () =>
        HttpResponse.json([integration])
      ),
      http.get(borrowApiRoute("/v1/markets"), () =>
        HttpResponse.json({
          items: [twoCollateralMarket],
          limit: 100,
          offset: 0,
          total: 1,
        })
      ),
      http.get(borrowApiRoute("/v1/positions"), () =>
        HttpResponse.json({
          ...position,
          supplyBalances: [wethSupplyBalance, wbtcBalance],
          totalCollateralUsd: "3000",
          totalSuppliedUsd: "3000",
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

    await userEvent.click(app.getByText("Manage"));
    await userEvent.click(app.getByText("USDC", { exact: true }).first());
    await app.getByRole("button", { name: "Details" }).click();
    await expect
      .poll(
        () =>
          app.getByTestId("borrow-collateral-toggle__disableCollateral").all()
            .length
      )
      .toBe(2);

    await app.getByRole("button", { name: "Actions" }).click();
    await app.getByTestId("borrow-position-action__withdraw").click();
    await expect
      .element(app.getByText("0.5 WETH withdrawable"))
      .toBeInTheDocument();

    await app.getByTestId("borrow-withdraw-token-select").click();
    const dialog = app.getByRole("dialog");
    await expect
      .element(dialog.getByRole("button", { name: /WETH/ }))
      .toHaveAttribute("aria-pressed", "true");
    await dialog.getByRole("button", { name: /WBTC/ }).click();

    await expect
      .element(app.getByText("0.04 WBTC withdrawable"))
      .toBeInTheDocument();
    await app.getByTestId("borrow-withdraw-token-select").click();
    await expect
      .element(app.getByRole("dialog").getByRole("button", { name: /WBTC/ }))
      .toHaveAttribute("aria-pressed", "true");

    await app.unmount();
  });

  it("refreshes the position on confirmation while Complete stays an immutable snapshot", async ({
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
        // Every refetch after the first waits, so the test can observe the
        // details pane while the refresh is in flight.
        await positionRefresh;
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
      walletListFactory: mockWalletListFactory({ accounts: [account] }),
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
    await app.getByRole("button", { name: "Review withdrawal" }).click();
    await app.getByRole("button", { name: "Confirm" }).click();

    await expect
      .poll(
        () =>
          app.container.querySelector('[data-rk="borrow-steps-page"]') !== null
      )
      .toBe(true);

    releaseActionStatus();
    await expect
      .poll(
        () =>
          app.container.querySelector('[data-rk="borrow-complete-page"]') !==
          null
      )
      .toBe(true);
    await expect
      .poll(() => positionRequests, { timeout: 5_000 })
      .toBeGreaterThanOrEqual(2);
    // The refetch is background work: the details pane keeps the position it
    // already has instead of falling back to its skeleton.
    await expect.element(app.getByText("Net worth")).toBeInTheDocument();
    releasePositionRefresh();
    await expect
      .element(app.getByRole("button", { name: "Back to positions" }))
      .toBeVisible();

    await expect
      .element(app.getByText("Withdrawal complete"))
      .toBeInTheDocument();
    await expect
      .element(app.getByText("No open position in this market."))
      .toBeInTheDocument();
    await expect
      .element(app.getByText("Something went wrong"))
      .not.toBeInTheDocument();

    await app.getByRole("button", { name: "Back to positions" }).click();
    await expect.element(app.getByText("My positions")).toBeVisible();
    await expect
      .element(app.getByText("No open position in this market."))
      .not.toBeInTheDocument();

    await app.unmount();
  });
});
