import { HttpResponse, http } from "msw";
import { userEvent } from "vitest/browser";
import type { BorrowAccountPosition } from "../../src/features/borrow/core";
import { borrowApiRoute } from "../mocks/api-routes";
import { rkMockWallet } from "../utils/mock-connector";
import { describe, expect, it } from "../utils/test-extend";
import { renderApp } from "../utils/test-utils";

const account = "0x0000000000000000000000000000000000000001";

type PositionDto = typeof BorrowAccountPosition.Encoded;

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
      tokenAddress: market.collateralTokens[0].token.address,
      tokenSymbol: "WETH",
    },
  ],
  totalBorrowedUsd: "400",
  totalCollateralUsd: "1000",
  totalSuppliedUsd: "1000",
};

describe("Borrow position details", () => {
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
    await expect.element(app.getByText("Loan to value")).toBeInTheDocument();
    await expect.element(app.getByText("Collateral value")).toBeInTheDocument();
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

    app.unmount();
  });
});
