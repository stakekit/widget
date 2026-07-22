import { HttpResponse, http } from "msw";
import { userEvent } from "vitest/browser";
import { DashboardYieldCategory } from "../../src/public-api/types";
import { legacyYieldFixture, yieldApiYieldFixture } from "../fixtures";
import {
  borrowApiRoute,
  legacyApiRoute,
  yieldApiRoute,
} from "../mocks/api-routes";
import { mockDelay } from "../mocks/delay";
import { rkMockWallet } from "../utils/mock-connector";
import { describe, expect, it } from "../utils/test-extend";
import { renderApp } from "../utils/test-utils";

type LegacyTokenDto = ReturnType<typeof legacyYieldFixture>["token"];

const emptyBorrowPosition = {
  address: "0x0000000000000000000000000000000000000001",
  availableToBorrowUsd: "0",
  currentLtv: "0",
  debtBalances: [],
  healthFactor: null,
  integrationId: "aave-borrow",
  netApy: "0",
  netWorthUsd: "0",
  network: "ethereum",
  supplyBalances: [],
  totalBorrowedUsd: "0",
  totalCollateralUsd: "0",
  totalSuppliedUsd: "0",
} as const;

const dashboardCategoryYieldsHandler = () => {
  const stakeYield = yieldApiYieldFixture({
    id: "ethereum-eth-native-staking",
  });
  const defiYield = yieldApiYieldFixture({
    id: "ethereum-usdc-lending",
    mechanics: {
      ...stakeYield.mechanics,
      type: "lending",
    },
  });
  const rwaYield = yieldApiYieldFixture({
    id: "ethereum-usdc-real-world-asset",
    mechanics: {
      ...stakeYield.mechanics,
      type: "real_world_asset",
    },
  });

  return http.get(yieldApiRoute("/v1/yields"), async () => {
    await mockDelay();

    const items = [stakeYield, defiYield, rwaYield];

    return HttpResponse.json({
      items,
      total: items.length,
      offset: 0,
      limit: items.length,
    });
  });
};

describe("Renders initial page", () => {
  it("Works as expected", async ({ worker }) => {
    const avalancheCToken: LegacyTokenDto = {
      name: "Avalanche C Chain",
      symbol: "AVAX",
      decimals: 18,
      network: "avalanche-c",
      coinGeckoId: "avalanche-2",
      logoURI: "https://assets.stakek.it/tokens/avax.svg",
    };

    const ether: LegacyTokenDto = {
      network: "ethereum",
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
      coinGeckoId: "ethereum",
      logoURI: "https://assets.stakek.it/tokens/eth.svg",
    };

    const legacyYieldBase = legacyYieldFixture();
    const yieldApiYieldBase = yieldApiYieldFixture();
    const avalancheAvaxNativeStaking = legacyYieldFixture({
      id: "avalanche-avax-native-staking",
      token: avalancheCToken,
      tokens: [avalancheCToken],
      metadata: {
        ...legacyYieldBase.metadata,
        type: "staking",
        gasFeeToken: avalancheCToken,
      },
    });
    const etherNativeStaking = legacyYieldFixture({
      id: "ethereum-eth-etherfi-staking",
      token: ether,
      tokens: [ether],
      metadata: {
        ...legacyYieldBase.metadata,
        type: "staking",
        gasFeeToken: ether,
      },
    });

    const avalancheAvaxNativeStakingYieldApi = yieldApiYieldFixture({
      id: avalancheAvaxNativeStaking.id,
      network: avalancheCToken.network,
      token: avalancheCToken,
      tokens: [avalancheCToken],
      inputTokens: [avalancheCToken],
      outputToken: avalancheCToken,
      mechanics: {
        ...yieldApiYieldBase.mechanics,
        type: "staking",
        gasFeeToken: avalancheCToken,
      },
    });
    const etherNativeStakingYieldApi = yieldApiYieldFixture({
      id: etherNativeStaking.id,
      network: ether.network,
      token: ether,
      tokens: [ether],
      inputTokens: [ether],
      outputToken: ether,
      mechanics: {
        ...yieldApiYieldBase.mechanics,
        type: "staking",
        gasFeeToken: ether,
      },
    });

    worker.use(
      http.get(legacyApiRoute("/v1/yields/enabled/networks"), async () => {
        await mockDelay();
        return HttpResponse.json([
          etherNativeStaking.token.network,
          avalancheAvaxNativeStaking.token.network,
        ]);
      }),

      http.get(legacyApiRoute("/v1/tokens"), async () => {
        await mockDelay();

        return HttpResponse.json([
          { token: ether, availableYields: [etherNativeStaking.id] },
          {
            token: avalancheCToken,
            availableYields: [avalancheAvaxNativeStaking.id],
          },
        ]);
      }),

      http.get(
        legacyApiRoute(`/v1/yields/${etherNativeStaking.id}`),
        async () => {
          await mockDelay();

          return HttpResponse.json(etherNativeStaking);
        }
      ),
      http.get(yieldApiRoute("/v1/yields"), async () => {
        await mockDelay();

        const items = [
          etherNativeStakingYieldApi,
          avalancheAvaxNativeStakingYieldApi,
        ];

        return HttpResponse.json({
          items,
          total: items.length,
          offset: 0,
          limit: items.length,
        });
      }),
      http.get(
        yieldApiRoute(`/v1/yields/${etherNativeStaking.id}`),
        async () => {
          await mockDelay();

          return HttpResponse.json(etherNativeStakingYieldApi);
        }
      ),
      http.get(
        legacyApiRoute(`/v1/yields/${avalancheAvaxNativeStaking.id}`),
        async () => {
          await mockDelay();

          return HttpResponse.json(avalancheAvaxNativeStaking);
        }
      ),
      http.get(
        yieldApiRoute(`/v1/yields/${avalancheAvaxNativeStaking.id}`),
        async () => {
          await mockDelay();

          return HttpResponse.json(avalancheAvaxNativeStakingYieldApi);
        }
      )
    );

    const app = await renderApp();

    await expect.element(app.getByTestId("number-input")).toBeInTheDocument();
    await expect.element(app.getByText("Manage")).toBeInTheDocument();
    await expect.element(app.getByText("Connect Wallet")).toBeInTheDocument();

    app.unmount();
  });

  it("uses category dashboard yield grouping by default with Borrow disabled", async ({
    worker,
  }) => {
    worker.use(dashboardCategoryYieldsHandler());

    const app = await renderApp({
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        dashboardVariant: true,
      },
    });

    await expect.element(app.getByText("Stake")).toBeInTheDocument();
    await expect.element(app.getByText("DeFi")).toBeInTheDocument();
    await expect.element(app.getByText("RWA")).toBeInTheDocument();
    await expect.element(app.getByText("Manage")).toBeInTheDocument();
    await expect.element(app.getByText("Activity")).toBeInTheDocument();

    const tabsSection = app.container.querySelector("[data-rk='tabs-section']");
    const tabsText = tabsSection?.textContent ?? "";

    expect(tabsText).toContain("Stake");
    expect(tabsText).toContain("DeFi");
    expect(tabsText).toContain("RWA");
    expect(tabsText).not.toContain("Borrow");
    expect(tabsText).not.toContain("Earn");

    app.unmount();
  });

  it("shows Borrow when enabled with dashboard category grouping", async ({
    worker,
  }) => {
    worker.use(dashboardCategoryYieldsHandler());

    const app = await renderApp({
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        borrowEnabled: true,
        dashboardVariant: true,
      },
    });

    await expect.element(app.getByText("Stake")).toBeInTheDocument();
    await expect.element(app.getByText("DeFi")).toBeInTheDocument();
    await expect.element(app.getByText("RWA")).toBeInTheDocument();
    await expect.element(app.getByText("Borrow")).toBeInTheDocument();

    const tabsSection = app.container.querySelector("[data-rk='tabs-section']");
    const tabsText = tabsSection?.textContent ?? "";

    expect(tabsText).toContain("Stake");
    expect(tabsText).toContain("DeFi");
    expect(tabsText).toContain("RWA");
    expect(tabsText).toContain("Borrow");
    expect(tabsText).toContain("Manage");
    expect(tabsText).toContain("Activity");

    app.unmount();
  });

  it("hides Borrow when dashboard yield grouping is flat", async () => {
    const app = await renderApp({
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        borrowEnabled: true,
        dashboardVariant: true,
        yieldGrouping: "flat",
      },
    });

    const tabsSection = app.container.querySelector("[data-rk='tabs-section']");
    const tabsText = tabsSection?.textContent ?? "";

    expect(tabsText).toContain("Earn");
    expect(tabsText).not.toContain("Borrow");
    expect(tabsText).toContain("Manage");
    expect(tabsText).toContain("Activity");

    app.unmount();
  });

  it("uses the configured dashboard category tab order", async ({ worker }) => {
    worker.use(dashboardCategoryYieldsHandler());

    const app = await renderApp({
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        borrowEnabled: true,
        dashboardVariant: true,
        dashboardYieldCategoryOrder: [
          DashboardYieldCategory.Stake,
          DashboardYieldCategory.DeFi,
          DashboardYieldCategory.RWA,
        ],
      },
    });

    await expect
      .element(app.getByText("Stake", { exact: true }))
      .toBeInTheDocument();
    await expect
      .element(app.getByText("DeFi", { exact: true }))
      .toBeInTheDocument();
    await expect
      .element(app.getByText("RWA", { exact: true }))
      .toBeInTheDocument();
    await expect
      .element(app.getByText("Borrow", { exact: true }))
      .toBeInTheDocument();
    await expect
      .element(app.getByText("Manage", { exact: true }))
      .toBeInTheDocument();
    await expect
      .element(app.getByText("Activity", { exact: true }))
      .toBeInTheDocument();

    const tabsSection = app.container.querySelector("[data-rk='tabs-section']");
    const tabsText = tabsSection?.textContent ?? "";

    expect(tabsText.indexOf("Stake")).toBeLessThan(tabsText.indexOf("DeFi"));
    expect(tabsText.indexOf("DeFi")).toBeLessThan(tabsText.indexOf("RWA"));
    expect(tabsText.indexOf("RWA")).toBeLessThan(tabsText.indexOf("Borrow"));
    expect(tabsText.indexOf("Borrow")).toBeLessThan(tabsText.indexOf("Manage"));
    expect(tabsText.indexOf("Manage")).toBeLessThan(
      tabsText.indexOf("Activity")
    );

    app.unmount();
  });

  it("updates the selected dashboard category after route tab changes", async ({
    worker,
  }) => {
    worker.use(dashboardCategoryYieldsHandler());

    const app = await renderApp({
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        borrowEnabled: true,
        dashboardVariant: true,
      },
    });
    const clickTab = (label: string) => {
      const tabsSection = app.container.querySelector(
        "[data-rk='tabs-section']"
      );
      const tab = [...(tabsSection?.querySelectorAll("p") ?? [])].find(
        (el) => el.textContent === label
      );

      expect(tab).not.toBeUndefined();
      tab?.click();
    };

    await expect
      .element(app.getByText("RWA"))
      .toHaveAttribute("data-state", "selected");

    clickTab("DeFi");

    await expect
      .element(app.getByText("DeFi"))
      .toHaveAttribute("data-state", "selected");
    await expect
      .element(app.getByText("RWA"))
      .toHaveAttribute("data-state", "default");

    clickTab("Borrow");
    await expect
      .element(app.getByText("Borrow").first())
      .toHaveAttribute("data-state", "selected");

    clickTab("Stake");
    await expect
      .element(app.getByText("Stake").first())
      .toHaveAttribute("data-state", "selected");

    clickTab("Manage");
    await expect
      .element(app.getByText("Manage").first())
      .toHaveAttribute("data-state", "selected");

    clickTab("RWA");
    await expect
      .element(app.getByText("RWA").first())
      .toHaveAttribute("data-state", "selected");

    clickTab("Activity");
    await expect
      .element(app.getByText("Activity").first())
      .toHaveAttribute("data-state", "selected");

    clickTab("DeFi");
    await expect
      .element(app.getByText("DeFi").first())
      .toHaveAttribute("data-state", "selected");

    app.unmount();
  });

  it("opens the native Borrow dashboard tab", async ({ worker }) => {
    const tokenBalanceRequestSignals: AbortSignal[] = [];
    const yieldBalanceRequestSignals: AbortSignal[] = [];

    worker.use(
      http.post(
        legacyApiRoute("/v1/tokens/balances/scan"),
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
        HttpResponse.json(emptyBorrowPosition)
      ),
      http.get(borrowApiRoute("/v1/integrations"), () =>
        HttpResponse.json([
          {
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
          },
        ])
      ),
      http.get(borrowApiRoute("/v1/markets"), () =>
        HttpResponse.json({
          total: 1,
          offset: 0,
          limit: 100,
          items: [
            {
              id: "aave-v3-ethereum-usdc",
              integrationId: "aave-borrow",
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
                {
                  token: {
                    address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
                    symbol: "WBTC",
                    name: "Wrapped Bitcoin",
                    decimals: 8,
                  },
                  priceUsd: "60000",
                  maxLtv: "0.75",
                  liquidationThreshold: "0.8",
                  liquidationPenalty: "0.05",
                  supplyRate: "0.015",
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
            },
            {
              id: "aave-v3-ethereum-dai",
              integrationId: "aave-borrow",
              network: "ethereum",
              type: "pool",
              poolAddress: "0x0000000000000000000000000000000000000002",
              loanToken: {
                address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
                symbol: "DAI",
                name: "Dai Stablecoin",
                decimals: 18,
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
              borrowRate: "0.04",
              totalSupply: "500000",
              totalSupplyRaw: "500000000000000000000000",
              totalBorrow: "125000",
              totalBorrowRaw: "125000000000000000000000",
              availableLiquidity: "375000",
              availableLiquidityRaw: "375000000000000000000000",
              utilizationRate: "0.25",
              loanTokenPriceUsd: "1",
              isBorrowEnabled: true,
              supplyCollateralFeeBps: "0",
              feeWrapperAddress: null,
              minLoan: null,
            },
          ],
        })
      )
    );

    const app = await renderApp({
      wagmi: {
        __customConnectors__: rkMockWallet({
          accounts: ["0x0000000000000000000000000000000000000001"],
        }),
      },
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        borrowEnabled: true,
        dashboardVariant: true,
      },
    });

    await userEvent.click(app.getByText("Borrow"));

    await expect.element(app.getByText("Borrow APY")).toBeInTheDocument();
    await expect.element(app.getByText("Market stats")).toBeInTheDocument();
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

    await app.getByTestId("borrow-market-select").click();
    await expect
      .element(app.getByText("Select borrow market"))
      .toBeInTheDocument();
    await app
      .getByTestId("select-modal__container")
      .getByTestId("borrow-market-select__group_dai")
      .click();
    await app
      .getByTestId("select-modal__container")
      .getByTestId("borrow-market-select__item_aave-v3-ethereum-dai")
      .click();
    await expect.element(app.getByText("WETH / DAI")).toBeInTheDocument();

    await userEvent.click(app.getByTestId("number-input").last());
    await userEvent.keyboard("1");
    await expect
      .element(app.getByText("Amount exceeds wallet balance."))
      .toBeInTheDocument();
    expect(app.container.textContent).not.toContain("3M");
    expect(tokenBalanceRequestSignals.every((signal) => !signal.aborted)).toBe(
      true
    );
    expect(yieldBalanceRequestSignals.every((signal) => !signal.aborted)).toBe(
      true
    );

    app.unmount();
  });

  it("opens the native Borrow review screen", async ({ worker }) => {
    const account = "0x0000000000000000000000000000000000000001";

    worker.use(
      http.post(legacyApiRoute("/v1/tokens/balances/scan"), () =>
        HttpResponse.json([
          {
            token: {
              network: "ethereum",
              address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
              symbol: "WETH",
              name: "Wrapped Ether",
              decimals: 18,
            },
            amount: "1",
            availableYields: [],
          },
        ])
      ),
      http.get(borrowApiRoute("/v1/positions"), () =>
        HttpResponse.json(emptyBorrowPosition)
      ),
      http.get(borrowApiRoute("/v1/integrations"), () =>
        HttpResponse.json([
          {
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
          },
        ])
      ),
      http.get(borrowApiRoute("/v1/markets"), () =>
        HttpResponse.json({
          total: 1,
          offset: 0,
          limit: 100,
          items: [
            {
              id: "aave-v3-ethereum-usdc",
              integrationId: "aave-borrow",
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
            },
          ],
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

    await userEvent.click(app.getByText("Borrow"));
    await expect.element(app.getByText("Borrow APY")).toBeInTheDocument();

    await userEvent.click(app.getByTestId("number-input").first());
    await userEvent.keyboard("25");
    await userEvent.click(app.getByTestId("number-input").last());
    await userEvent.keyboard("0.5");
    await app.getByRole("button", { name: "Review borrow" }).click();

    await expect
      .element(app.getByText("Borrow and supply collateral"))
      .toBeInTheDocument();
    await expect.element(app.getByText("25 USDC")).toBeInTheDocument();
    await expect.element(app.getByText("0.5 WETH")).toBeInTheDocument();
    await expect
      .element(app.getByText("aave-v3-ethereum-usdc"))
      .toBeInTheDocument();

    app.unmount();
  });
});
