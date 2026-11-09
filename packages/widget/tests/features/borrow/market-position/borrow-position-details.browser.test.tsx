import { HttpResponse, http } from "msw";
import { page, userEvent } from "vitest/browser";
import {
  type BorrowAccountSnapshotDto,
  borrowWalletAddress,
  makeBorrowAccountSnapshotDto,
  makeBorrowCollateralTokenDto,
  makeBorrowDebtBalanceDto,
  makeBorrowIntegrationDto,
  makeBorrowMarketDto,
  makeBorrowSupplyBalanceDto,
  usdcTokenAddress,
  wethTokenAddress,
} from "../../../fixtures/borrow";
import { borrowApiRoute } from "../../../mocks/api-routes";
import { mockWalletListFactory } from "../../../utils/mock-connector";
import { describe, expect, it } from "../../../utils/test-extend";
import { renderApp } from "../../../utils/test-utils";

const account = borrowWalletAddress;

const integration = makeBorrowIntegrationDto({ name: "Aave V3 Borrow" });

const wethCollateral = makeBorrowCollateralTokenDto();

const market = makeBorrowMarketDto();

const wethPositionState = {
  availableToBorrowUsd: "450",
  currentLtv: "0.4",
  healthFactor: "2.125",
  liquidationThreshold: "0.85",
};

const wethSupplyPendingActions = [
  {
    args: {
      amountRaw: "500000000000000000",
      marketId: market.id,
      tokenAddress: wethTokenAddress,
    },
    label: "Withdraw",
    type: "withdraw",
  },
  {
    args: {
      marketId: market.id,
      tokenAddress: wethTokenAddress,
    },
    label: "Disable collateral",
    type: "disableCollateral",
  },
];

const wethSupplyBalance = makeBorrowSupplyBalanceDto({
  pendingActions: wethSupplyPendingActions,
  positionState: wethPositionState,
});

const position = makeBorrowAccountSnapshotDto({
  debtBalances: [
    makeBorrowDebtBalanceDto({
      pendingActions: [
        {
          args: {
            marketId: market.id,
            tokenAddress: usdcTokenAddress,
          },
          label: "Repay",
          type: "repay",
        },
      ],
    }),
  ],
  supplyBalances: [wethSupplyBalance],
  totalCollateralUsd: "1000",
  totalSuppliedUsd: "1000",
});

const emptyPosition = makeBorrowAccountSnapshotDto({
  availableToBorrowUsd: "0",
  currentLtv: "0",
  debtBalances: [],
  healthFactor: null,
  netApy: "0",
  netWorthUsd: "0",
  totalBorrowedUsd: "0",
});

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
    await app.getByRole("tab", { name: "Withdraw", exact: true }).click();
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
      .toHaveAttribute("aria-invalid", "true");
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
        wethCollateral,
        {
          ...wethCollateral,
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
      '[data-testid="borrow-amount-section"]'
    );
    expect(borrowSection?.textContent).not.toContain("available");
    expect(borrowSection?.textContent).not.toContain("Max");

    await app.getByTestId("borrow-market-select").click();
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

    await expect.element(app.getByText("Total value")).toBeInTheDocument();
    await expect
      .element(app.getByText("Debt", { exact: true }))
      .toBeInTheDocument();
    await expect.element(app.getByText("Net worth")).toBeInTheDocument();
    // A safe position adds nothing to the Manage tab's count.
    await expect
      .element(app.getByRole("tab", { name: "Manage", exact: true }))
      .toBeInTheDocument();
    await expect.element(app.getByText("WETH/USDC")).toBeInTheDocument();
    await expect
      .element(app.getByText("Aave V3", { exact: false }))
      .toBeInTheDocument();

    await userEvent.click(app.getByText("WETH/USDC"));

    // The summary leads: net worth, debt, health factor and the LTV gauge.
    const summary = app.getByTestId("borrow-position-summary");
    await expect
      .element(summary.getByText("Your position"))
      .toBeInTheDocument();
    await expect
      .element(summary.getByText("Health factor"))
      .toBeInTheDocument();
    // 2.125 truncates to two places, never rounding up.
    await expect.element(summary.getByText("2.12")).toBeInTheDocument();
    await expect.element(summary.getByText("$400.00")).toBeInTheDocument();
    await expect
      .element(summary.getByRole("meter", { name: "Loan to value" }))
      .toBeInTheDocument();
    // A safe position raises no liquidation alert.
    await expect
      .element(app.getByTestId("borrow-position-risk-alert"))
      .not.toBeInTheDocument();
    expect(app.container.textContent).toContain("Ethereum");
    // The details start open and hold the collateral and market terms.
    await expect
      .element(app.getByTestId("borrow-position-details-disclosure"))
      .toHaveAttribute("aria-expanded", "true");
    await expect
      .element(app.getByText("Collateral", { exact: true }))
      .toBeInTheDocument();
    await expect.element(app.getByText("Borrow APY")).toBeInTheDocument();
    // The actions are tabs, Repay selected first with its form in the panel.
    await expect
      .element(app.getByRole("tab", { name: "Repay", exact: true }))
      .toHaveAttribute("aria-selected", "true");
    await expect
      .element(app.getByRole("tab", { name: "Withdraw", exact: true }))
      .toHaveAttribute("aria-selected", "false");
    await expect
      .element(app.getByRole("button", { name: "Review repayment" }))
      .toBeInTheDocument();
    // The selected tab names the verb, so the field is just the amount.
    await expect
      .element(app.getByRole("textbox", { name: "Amount" }))
      .toBeInTheDocument();
    // The position's page leads with a way back to the positions list.
    await expect
      .element(app.getByTestId("borrow-position-details-back"))
      .toBeVisible();
    await expect
      .element(app.getByText("USDC outstanding", { exact: false }))
      .toBeInTheDocument();
    await expect
      .element(app.getByRole("button", { name: "Disable collateral" }))
      .not.toBeInTheDocument();
    // The collateral switches stay with the collateral in the details.
    const disableToggle = app.getByTestId(
      "borrow-collateral-toggle__disableCollateral"
    );
    await expect.element(disableToggle).toHaveAttribute("aria-checked", "true");
    // Disabling the only collateral behind $400 of debt is a Risk Gate Block.
    await expect
      .element(disableToggle)
      .toHaveAttribute("aria-disabled", "true");
    await expect
      .element(
        app.getByText(
          "Disabling this collateral would drop the health factor below 1. Repay debt or add other collateral first."
        )
      )
      .toBeInTheDocument();
    await app.getByRole("tab", { name: "Withdraw", exact: true }).click();

    await expect
      .element(app.getByText("0.5 WETH withdrawable"))
      .toBeInTheDocument();
    await expect
      .element(app.getByRole("tab", { name: "Withdraw", exact: true }))
      .toHaveAttribute("aria-selected", "true");

    // Withdrawing 0.4 of 0.5 WETH leaves $200 of collateral behind $400 of
    // debt: the Risk Gate blocks and the form says which limit and why.
    const amountInput = app.getByTestId("number-input");
    await userEvent.click(amountInput);
    await userEvent.keyboard("0.4");
    await expect
      .element(app.getByText("This action can't be confirmed"))
      .toBeInTheDocument();
    await expect
      .element(
        app.getByText(
          "The projected health factor would fall below 1, so the protocol would reject this action or the position could be liquidated. Reduce the amount or add collateral."
        )
      )
      .toBeInTheDocument();
    await expect
      .element(app.getByText("Withdrawal would exceed the market LTV limit."))
      .not.toBeInTheDocument();
    await expect
      .element(app.getByRole("button", { name: "Review withdrawal" }))
      .toBeDisabled();

    await userEvent.clear(amountInput);
    await userEvent.keyboard("0.1");
    await expect
      .element(app.getByText("This action can't be confirmed"))
      .not.toBeInTheDocument();
    await app.getByRole("button", { name: "Review withdrawal" }).click();

    await expect.element(app.getByText("Withdraw WETH")).toBeInTheDocument();
    await expect
      .element(app.getByRole("button", { name: "Back to position" }))
      .toBeInTheDocument();

    // Beside Review, the position's summary and details stay in view.
    await expect
      .element(app.getByTestId("borrow-position-summary"))
      .toBeInTheDocument();
    await expect
      .element(app.getByTestId("borrow-position-details-disclosure"))
      .toBeInTheDocument();
    await app.getByRole("button", { name: "Back to position" }).click();

    await expect
      .element(app.getByRole("tab", { name: "Repay", exact: true }))
      .toBeInTheDocument();

    const breadcrumbBack = app.container.querySelector<HTMLButtonElement>(
      '[data-testid="borrow-position-details-back"]'
    );

    expect(breadcrumbBack).not.toBeNull();

    breadcrumbBack!.click();

    await expect.element(app.getByText("My positions")).toBeInTheDocument();
    await expect.element(app.getByText("Total value")).toBeInTheDocument();

    await app.unmount();
  });

  it("opens a market position on its own page, its actions beside it", async ({
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
    await page.viewport(1440, 1000);

    const app = await renderApp({
      walletListFactory: mockWalletListFactory({ accounts: [account] }),
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        borrowEnabled: true,
        dashboardVariant: true,
      },
    });

    await userEvent.click(app.getByText("Manage"));
    const row = app.getByRole("link", { name: /WETH\/USDC/ });
    await expect.element(row).toBeInTheDocument();

    await row.click();

    // The position takes the page: the actions on the left, the position on
    // the right, its summary over its collapsed details.
    await expect
      .element(app.getByRole("tab", { name: "Repay", exact: true }))
      .toBeInTheDocument();
    await expect.element(row).not.toBeInTheDocument();
    await expect.element(app.getByText("My positions")).not.toBeInTheDocument();
    const summary = app.getByTestId("borrow-position-summary").element();
    const actions = app
      .getByRole("tab", { name: "Repay", exact: true })
      .element();
    const details = app
      .getByTestId("borrow-position-details-disclosure")
      .element();
    expect(actions.getBoundingClientRect().right).toBeLessThan(
      summary.getBoundingClientRect().left
    );
    expect(summary.getBoundingClientRect().bottom).toBeLessThan(
      details.getBoundingClientRect().top
    );

    // Back returns to the positions list.
    await app.getByTestId("borrow-position-details-back").click();
    await expect.element(app.getByText("My positions")).toBeInTheDocument();
    await expect
      .element(app.getByRole("link", { name: /WETH\/USDC/ }))
      .toBeInTheDocument();
    await app.unmount();
    await page.viewport(800, 900);
  });

  it("alerts a position at 92% LTV as in danger and offers Repay", async ({
    worker,
  }) => {
    // $920 of debt behind $1,000 of collateral: past the 80% max LTV, a 2.91%
    // fall in collateral value from liquidation.
    const riskyPosition: BorrowAccountSnapshotDto = {
      ...position,
      currentLtv: "0.92",
      debtBalances: position.debtBalances.map((debt) => ({
        ...debt,
        balance: "920",
        balanceRaw: "920000000",
        balanceUsd: "920",
      })),
      healthFactor: "1.03",
      netWorthUsd: "80",
      supplyBalances: [
        {
          ...wethSupplyBalance,
          positionState: {
            ...wethPositionState,
            currentLtv: "0.92",
            healthFactor: "1.03",
          },
        },
      ],
      totalBorrowedUsd: "920",
    };
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
        HttpResponse.json(riskyPosition)
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

    // The Manage tab counts the position, and its row names the risk.
    const manageTab = app.getByRole("tab", { name: "Manage 1 action to take" });
    await expect.element(manageTab).toBeInTheDocument();
    await userEvent.click(manageTab);
    await expect
      .element(
        app
          .getByRole("link", { name: /WETH\/USDC/ })
          .getByText("High liquidation risk")
      )
      .toBeInTheDocument();
    await userEvent.click(app.getByText("WETH/USDC"));

    const alert = app.getByTestId("borrow-position-risk-alert");
    await expect
      .element(alert.getByText("High liquidation risk"))
      .toBeInTheDocument();
    await expect
      .element(
        alert.getByText(
          "A 2.91% drop in collateral value would liquidate this position. Repay debt to lower the risk."
        )
      )
      .toBeInTheDocument();
    // The alert sits right under the summary and its loan to value gauge.
    const gauge = app.getByRole("meter", { name: "Loan to value" });
    await expect.element(gauge).toHaveAttribute("aria-valuenow", "92");
    expect(
      app
        .getByTestId("borrow-position-summary")
        .element()
        .getBoundingClientRect().bottom
    ).toBeLessThan(alert.element().getBoundingClientRect().top);

    // From Withdraw, Repay chooses Repay and focuses its amount.
    await app.getByRole("tab", { name: "Withdraw", exact: true }).click();
    await alert.getByRole("button", { name: "Repay" }).click();

    await expect
      .element(app.getByRole("tab", { name: "Repay", exact: true }))
      .toHaveAttribute("aria-selected", "true");
    await expect
      .element(app.getByRole("button", { name: "Review repayment" }))
      .toBeInTheDocument();
    const amount = app.getByTestId("number-input");
    await expect.element(amount).toHaveFocus();

    // Already on Repay, it keeps the typed amount and focuses it again.
    await userEvent.keyboard("10");
    await userEvent.click(app.getByText("Loan to value", { exact: true }));
    await expect.element(amount).not.toHaveFocus();
    await alert.getByRole("button", { name: "Repay" }).click();

    await expect.element(amount).toHaveFocus();
    await expect.element(amount).toHaveValue("10");

    await app.unmount();
  });

  it("keeps a pool collateral toggle review on the debt position its reserve backs", async ({
    worker,
  }) => {
    // Aave keys each balance by its own reserve, so the collateral toggle
    // targets the WETH reserve while the position lives under the USDC market.
    // WBTC keeps backing the debt, so the Risk Gate lets WETH be disabled.
    const wbtc = {
      address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
      decimals: 8,
      name: "Wrapped Bitcoin",
      symbol: "WBTC",
    } as const;
    const twoCollateralMarket = {
      ...market,
      collateralTokens: [
        wethCollateral,
        { ...wethCollateral, priceUsd: "50000", token: wbtc },
      ],
    };
    const collateralReserve = {
      ...market,
      id: "aave-v3-ethereum-weth",
      loanToken: wethCollateral.token,
    };
    worker.use(
      http.get(borrowApiRoute("/v1/integrations"), () =>
        HttpResponse.json([integration])
      ),
      http.get(borrowApiRoute("/v1/markets"), () =>
        HttpResponse.json({
          items: [twoCollateralMarket, collateralReserve],
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
              pendingActions: wethSupplyPendingActions.map((pendingAction) => ({
                ...pendingAction,
                args: {
                  ...pendingAction.args,
                  marketId: collateralReserve.id,
                },
              })),
            },
            {
              ...wethSupplyBalance,
              balance: "0.04",
              balanceRaw: "4000000",
              balanceUsd: "2000",
              pendingActions: [],
              tokenAddress: wbtc.address,
              tokenSymbol: wbtc.symbol,
            },
          ],
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
        wethCollateral,
        { ...wethCollateral, priceUsd: "50000", token: wbtc },
      ],
    };
    const wbtcBalance = {
      ...wethSupplyBalance,
      balance: "0.04",
      balanceRaw: "4000000",
      balanceUsd: "2000",
      pendingActions: wethSupplyPendingActions.map((pendingAction) => ({
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
    await expect
      .poll(
        () =>
          app.getByTestId("borrow-collateral-toggle__disableCollateral").all()
            .length
      )
      .toBe(2);

    await app.getByRole("tab", { name: "Withdraw", exact: true }).click();
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
    await expect
      .element(app.getByTestId("borrow-withdraw-token-select"))
      .toMatchTextContent("WBTC");
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
    await app.getByRole("tab", { name: "Withdraw", exact: true }).click();
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
    await expect
      .element(app.getByTestId("borrow-position-summary"))
      .toBeInTheDocument();
    // Until the refresh settles the position may be closed, so Complete
    // offers no way back to it.
    await expect
      .element(app.getByRole("button", { name: "View position" }))
      .not.toBeInTheDocument();
    releasePositionRefresh();
    await expect
      .element(app.getByRole("button", { name: "Back to positions" }))
      .toBeVisible();
    await expect
      .element(app.getByRole("button", { name: "View position" }))
      .not.toBeInTheDocument();

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
