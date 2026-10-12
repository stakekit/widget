import BigNumber from "bignumber.js";
import * as Schema from "effect/Schema";
import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import { Integration } from "../../../src/domain/borrow/catalog/integration";
import { Market } from "../../../src/domain/borrow/catalog/market";
import { decodeTokenId } from "../../../src/domain/borrow/ids";
import { BorrowAccountSnapshot } from "../../../src/domain/borrow/positions/borrow-account-snapshot";
import { deriveBorrowPositions } from "../../../src/domain/borrow/positions/borrow-positions";
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import { getBorrowDetailsModel } from "../../../src/features/borrow/borrow-entry/model/details";
import {
  getBorrowPositionActions,
  getBorrowPositionDetailsModel,
} from "../../../src/features/borrow/market-position/model/details";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);

const marketDto = {
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
  originationFeeBps: "0",
  originationFeeWrapperAddress: null,
  blueBundleOriginationFeeBps: null,
  minLoan: null,
} as const;

const integrationDto = {
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

const positionDto = Schema.decodeSync(BorrowAccountSnapshot)({
  address,
  availableToBorrowUsd: "450",
  currentLtv: "0.4",
  debtBalances: [
    {
      apy: "0.06",
      balance: "400",
      balanceRaw: "400000000",
      balanceUsd: "400",
      marketId: marketDto.id,
      pendingActions: [
        {
          args: {
            marketId: marketDto.id,
            tokenAddress: marketDto.loanToken.address,
          },
          label: "Repay",
          type: "repay",
        },
      ],
      tokenAddress: marketDto.loanToken.address,
      tokenSymbol: "USDC",
    },
  ],
  healthFactor: "2.125",
  integrationId: integrationDto.id,
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
      marketId: "aave-v3-ethereum-weth",
      pendingActions: [
        {
          args: {
            amountRaw: "500000000000000000",
            marketId: "aave-v3-ethereum-weth",
            tokenAddress: marketDto.collateralTokens[0].token.address,
          },
          label: "Withdraw",
          type: "withdraw",
        },
        {
          args: {
            marketId: "aave-v3-ethereum-weth",
            tokenAddress: marketDto.collateralTokens[0].token.address,
          },
          label: "Disable collateral",
          type: "disableCollateral",
        },
      ],
      tokenAddress: marketDto.collateralTokens[0].token.address,
      tokenSymbol: "WETH",
    },
  ],
  totalBorrowedUsd: "400",
  totalCollateralUsd: "1000",
  totalSuppliedUsd: "1000",
});

const deriveItems = (input: Parameters<typeof deriveBorrowPositions>[0]) =>
  deriveBorrowPositions(input).items;

const t = ((key: string) => key) as TFunction;

describe("borrow position items", () => {
  it("projects integration-level position responses into market positions", () => {
    const [position] = deriveItems({
      integrationAccountSnapshots: [
        {
          integration: Schema.decodeSync(Integration)(integrationDto),
          accountSnapshot: positionDto,
        },
      ],
      markets: [Schema.decodeSync(Market)(marketDto)],
    });

    expect(position?.id).toBe("aave-v3-ethereum-usdc");
    expect(position?.balances.debt?.balance).toEqual(new BigNumber(400));
    expect(position?.balances.supply).toHaveLength(1);
    expect(position?.risk.current).toMatchObject({
      healthFactor: new BigNumber("2.125"),
      ltv: new BigNumber("0.4"),
      status: "available",
    });
  });

  it("builds semantic descriptors for borrow position pending actions", () => {
    const [position] = deriveItems({
      integrationAccountSnapshots: [
        {
          integration: Schema.decodeSync(Integration)(integrationDto),
          accountSnapshot: positionDto,
        },
      ],
      markets: [Schema.decodeSync(Market)(marketDto)],
    });

    if (!position) {
      throw new Error("Expected borrow position");
    }

    const actions = getBorrowPositionActions({ position, t });

    expect(actions.map((action) => action.type)).toEqual([
      "repay",
      "withdraw",
      "disableCollateral",
    ]);
    expect(actions[0]?.pendingContext.type).toBe("repay");
    expect(actions[1]?.pendingContext.type).toBe("withdraw");
    expect(actions[2]?.pendingContext.type).toBe("disableCollateral");
  });

  it("preserves the exact supplied balance for Withdraw Max", () => {
    const [position] = deriveItems({
      integrationAccountSnapshots: [
        {
          integration: Schema.decodeSync(Integration)(integrationDto),
          accountSnapshot: positionDto,
        },
      ],
      markets: [Schema.decodeSync(Market)(marketDto)],
    });

    if (!position) {
      throw new Error("Expected borrow position");
    }

    const precisePosition = {
      ...position,
      balances: {
        ...position.balances,
        supply: position.balances.supply.map((balance) => ({
          ...balance,
          balance: new BigNumber("0.123456789012345678"),
          balanceRaw: 123_456_789_012_345_678n,
        })),
      },
    };
    const withdraw = getBorrowPositionActions({
      position: precisePosition,
      t,
    }).find((action) => action.type === "withdraw");

    expect(withdraw?.pendingContext).toMatchObject({
      type: "withdraw",
      tokens: [
        {
          availableAmount: new BigNumber("0.123456789012345678"),
        },
      ],
    });
  });

  it("derives borrow position details model from local position data", () => {
    const [position] = deriveItems({
      integrationAccountSnapshots: [
        {
          integration: Schema.decodeSync(Integration)(integrationDto),
          accountSnapshot: positionDto,
        },
      ],
      markets: [Schema.decodeSync(Market)(marketDto)],
    });

    if (!position) {
      throw new Error("Expected borrow position");
    }

    const model = getBorrowPositionDetailsModel({ position, t });

    expect(model.title).toBe("WETH/USDC");
    expect(model.providerName).toBe("Aave V3");
    expect(model.metricCards.map((card) => card.id)).toEqual([
      "net-worth",
      "debt",
      "ltv",
      "health-factor",
    ]);
    expect(model.breakdownRows.map((row) => row.id)).toEqual([
      `supply-${marketDto.collateralTokens[0].token.address.toLowerCase()}`,
      `debt-${marketDto.loanToken.address.toLowerCase()}`,
    ]);
    expect(model.detailRows.map((row) => row.id)).toContain("borrow-apy");
    expect(model.currentLtv).toEqual(new BigNumber("0.4"));
    expect(model.healthFactor).toEqual(new BigNumber("2.125"));
    expect(model.liquidationThreshold).toEqual(new BigNumber("0.85"));
    expect(model.collateralItems).toEqual([
      expect.objectContaining({
        isCollateral: true,
        label: "WETH",
      }),
    ]);
  });

  it("shows only borrowing metrics on the entry details screen", () => {
    const market = Schema.decodeSync(Market)(marketDto);
    const integration = Schema.decodeSync(Integration)(integrationDto);
    const model = getBorrowDetailsModel({
      balances: null,
      borrowAmount: new BigNumber(0),
      collateralAmount: new BigNumber(0),
      integration,
      market,
      t,
    });

    expect(model.metricCards.map((card) => card.id)).toEqual([
      "borrow-apy",
      "max-ltv",
    ]);
    expect(model.protocolRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "network", value: "Ethereum" }),
        expect.objectContaining({ id: "provider", value: "Aave V3" }),
      ])
    );
  });

  it("omits unavailable entry risk facts without placeholder values", () => {
    const market = Schema.decodeSync(Market)(marketDto);
    const model = getBorrowDetailsModel({
      balances: null,
      borrowAmount: new BigNumber(1),
      collateralAmount: new BigNumber(1),
      integration: Schema.decodeSync(Integration)(integrationDto),
      market,
      projection: {
        borrowMaxAmount: new BigNumber(10),
        borrowUsd: new BigNumber(1),
        collateralMaxAmount: new BigNumber(10),
        collateralUsd: new BigNumber(1),
        existingCollateralUsd: new BigNumber(0),
        existingDebtUsd: new BigNumber(0),
        maxLtv: null,
        projectedCollateralUsd: new BigNumber(1),
        projectedDebtUsd: new BigNumber(1),
        projectedHealthFactor: null,
        projectedLtv: new BigNumber(1),
        riskStatus: "unavailable",
      },
      t,
    });

    expect(model.formRows.map((row) => row.id)).not.toContain("ltv");
    expect(model.formRows.map((row) => row.id)).not.toContain("health-factor");
    expect(model.formRows.find((row) => row.id === "max-ltv")?.value).not.toBe(
      "-"
    );
  });

  it.each([
    {
      hf: "2",
      ltv: "0.4",
      expected: { hf: ["2", "default"], ltv: ["40%", "default"] },
    },
    {
      hf: "1.05",
      ltv: "0.7",
      expected: { hf: ["1.05", "warning"], ltv: ["70%", "warning"] },
    },
    {
      hf: "0.9",
      ltv: "0.8",
      expected: { hf: ["0.9", "danger"], ltv: ["80%", "danger"] },
    },
    {
      hf: "0.0001",
      ltv: "4116.78",
      expected: { hf: ["<0.01", "danger"], ltv: [">100%", "danger"] },
    },
  ])(
    "flags projected LTV $ltv and health factor $hf against a 75% max LTV",
    ({ expected, hf, ltv }) => {
      const model = getBorrowDetailsModel({
        balances: null,
        borrowAmount: new BigNumber(1),
        collateralAmount: new BigNumber(1),
        integration: null,
        market: Schema.decodeSync(Market)(marketDto),
        projection: {
          borrowMaxAmount: new BigNumber(10),
          borrowUsd: new BigNumber(1),
          collateralMaxAmount: new BigNumber(10),
          collateralUsd: new BigNumber(1),
          existingCollateralUsd: new BigNumber(0),
          existingDebtUsd: new BigNumber(0),
          maxLtv: new BigNumber("0.75"),
          projectedCollateralUsd: new BigNumber(1),
          projectedDebtUsd: new BigNumber(1),
          projectedHealthFactor: new BigNumber(hf),
          projectedLtv: new BigNumber(ltv),
          riskStatus: "available",
        },
        t,
      });
      const row = (id: string) => {
        const found = model.formRows.find((candidate) => candidate.id === id);
        return [found?.value, found?.tone ?? "default"];
      };

      expect(row("ltv")).toEqual(expected.ltv);
      expect(row("health-factor")).toEqual(expected.hf);
    }
  );
  it("keeps same-token collateral isolated by market and preserves API risk state", () => {
    const collateralAddress = "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf";
    const usdcMarketId = "morpho-blue-borrow-ethereum-cbbtc-usdc";
    const usdtMarketId = "morpho-blue-borrow-ethereum-cbbtc-usdt";
    const morphoIntegration = Schema.decodeSync(Integration)({
      ...integrationDto,
      id: "morpho-blue-borrow",
      name: "Morpho Blue Borrow",
      providerId: "morpho-blue",
    });
    const makeMarket = ({
      id,
      loanTokenAddress,
      loanTokenSymbol,
    }: {
      readonly id: string;
      readonly loanTokenAddress: string;
      readonly loanTokenSymbol: string;
    }) =>
      Schema.decodeSync(Market)({
        ...marketDto,
        borrowRate: "0.03856649526282294",
        collateralTokens: [
          {
            ...marketDto.collateralTokens[0],
            liquidationThreshold: "0.86",
            priceUsd: "63500",
            supplyRate: "0",
            token: {
              address: collateralAddress,
              decimals: 8,
              name: "Coinbase Wrapped BTC",
              symbol: "cbBTC",
            },
          },
        ],
        id,
        integrationId: morphoIntegration.id,
        loanToken: {
          address: loanTokenAddress,
          decimals: 6,
          name: loanTokenSymbol,
          symbol: loanTokenSymbol,
        },
        type: "isolated",
      });
    const usdcMarket = makeMarket({
      id: usdcMarketId,
      loanTokenAddress: marketDto.loanToken.address,
      loanTokenSymbol: "USDC",
    });
    const usdtMarket = makeMarket({
      id: usdtMarketId,
      loanTokenAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      loanTokenSymbol: "USDT",
    });
    const accountPosition = Schema.decodeSync(BorrowAccountSnapshot)({
      ...positionDto,
      availableToBorrowUsd: null,
      currentLtv: "0.1462",
      debtBalances: [
        {
          apy: "0.03856649526282294",
          balance: "0.500001",
          balanceRaw: "500001",
          balanceUsd: "0.50",
          marketId: usdcMarketId,
          pendingActions: [],
          tokenAddress: marketDto.loanToken.address,
          tokenSymbol: "USDC",
        },
      ],
      healthFactor: null,
      integrationId: morphoIntegration.id,
      netApy: "0.031224",
      netWorthUsd: "2.92",
      supplyBalances: [
        {
          apy: "0",
          balance: "0.00004000",
          balanceRaw: "4000",
          balanceUsd: "2.54",
          isCollateral: true,
          marketId: usdcMarketId,
          pendingActions: [],
          positionState: {
            availableToBorrowUsd: "1.69",
            currentLtv: "0.1968",
            healthFactor: "4.3708",
            liquidationThreshold: "0.8600",
          },
          tokenAddress: collateralAddress,
          tokenSymbol: "cbBTC",
        },
        {
          apy: "0",
          balance: "0.00001378",
          balanceRaw: "1378",
          balanceUsd: "0.88",
          isCollateral: true,
          marketId: usdtMarketId,
          pendingActions: [],
          positionState: {
            availableToBorrowUsd: "0.75",
            currentLtv: "0",
            healthFactor: null,
            liquidationThreshold: "0.8600",
          },
          tokenAddress: collateralAddress,
          tokenSymbol: "cbBTC",
        },
      ],
      totalBorrowedUsd: "0.50",
      totalCollateralUsd: "3.42",
      totalSuppliedUsd: "3.42",
    });
    const positions = deriveItems({
      integrationAccountSnapshots: [
        {
          accountSnapshot: accountPosition,
          integration: morphoIntegration,
        },
      ],
      markets: [usdcMarket, usdtMarket],
    });
    const usdcPosition = positions.find(
      (position) => position.id === usdcMarket.id
    );

    expect(usdcPosition?.balances.supply).toEqual([
      expect.objectContaining({
        balanceUsd: new BigNumber("2.54"),
        marketId: usdcMarket.id,
      }),
    ]);
    expect(usdcPosition?.metrics.totalCollateralUsd).toEqual(
      new BigNumber("2.54")
    );
    expect(usdcPosition?.metrics.totalBorrowedUsd).toEqual(
      new BigNumber("0.5")
    );
    expect(usdcPosition?.risk.current).toMatchObject({
      healthFactor: new BigNumber("4.3708"),
      ltv: new BigNumber("0.1968"),
      status: "available",
    });
    expect(usdcPosition?.metrics.borrowApy).toBeCloseTo(0.0385665);

    if (!usdcPosition) {
      throw new Error("Expected USDC position");
    }

    const model = getBorrowPositionDetailsModel({ position: usdcPosition, t });
    expect(model.providerName).toBe("Morpho Blue");
    expect(model.healthFactor).toEqual(new BigNumber("4.3708"));
    expect(model.totalCollateralUsd).toBe("$2.54");
    expect(model.metricCards.find((card) => card.id === "debt")?.value).toBe(
      "$0.50"
    );
    expect(model.detailRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "network", value: "Ethereum" }),
        expect.objectContaining({ id: "borrow-apy", value: "3.85%" }),
      ])
    );
  });

  describe("pooled markets (Aave)", () => {
    const usdcAddress = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const ghoAddress = "0x7dfF72693f6A4149b17e7C6314655f6A9F7c8B33";
    const usdcMarketId = `aave-borrow-arbitrum-${usdcAddress.toLowerCase()}`;
    const ghoMarketId = `aave-borrow-arbitrum-${ghoAddress.toLowerCase()}`;
    const integration = Schema.decodeSync(Integration)({
      ...integrationDto,
      networks: ["arbitrum"],
    });
    const usdcCollateral = {
      ...marketDto.collateralTokens[0],
      liquidationThreshold: "0.78",
      maxLtv: "0.75",
      priceUsd: "1",
      token: {
        address: usdcAddress,
        decimals: 6,
        name: "USDC",
        symbol: "USDC",
      },
    };
    const makePoolMarket = (
      id: string,
      loanToken: {
        readonly address: string;
        readonly decimals: number;
        readonly name: string;
        readonly symbol: string;
      }
    ) =>
      Schema.decodeSync(Market)({
        ...marketDto,
        collateralTokens: [usdcCollateral],
        id,
        loanToken,
        network: "arbitrum",
      });
    const usdcMarket = makePoolMarket(usdcMarketId, usdcCollateral.token);
    const ghoMarket = makePoolMarket(ghoMarketId, {
      address: ghoAddress,
      decimals: 18,
      name: "GHO",
      symbol: "GHO",
    });
    const usdcSupply = {
      apy: "0.030709571250634451039671411",
      balance: "0.039999000000000000",
      balanceRaw: "39999",
      balanceUsd: "0.04",
      isCollateral: true,
      marketId: usdcMarketId,
      pendingActions: [],
      tokenAddress: usdcAddress,
      tokenSymbol: "USDC",
    };
    const ghoDebt = {
      apy: "0.043041185958700091913825920",
      balance: "0.010000000000000000",
      balanceRaw: "10000000000000000",
      balanceUsd: "0.01",
      marketId: ghoMarketId,
      pendingActions: [],
      tokenAddress: ghoAddress,
      tokenSymbol: "GHO",
    };
    // Shape returned by the borrow API for ENG-5161: every Aave balance is
    // keyed by its own reserve, so collateral never shares the debt marketId.
    const accountSnapshotDto = {
      address,
      availableToBorrowUsd: "0.01",
      currentLtv: "0.2500",
      debtBalances: [ghoDebt],
      healthFactor: "3.119555400444599555",
      integrationId: integration.id,
      netApy: "0.026599",
      netWorthUsd: "0.03",
      network: "arbitrum" as const,
      supplyBalances: [usdcSupply],
      totalBorrowedUsd: "0.01",
      totalCollateralUsd: "0.03",
      totalSuppliedUsd: "0.04",
    };
    const accountSnapshot = Schema.decodeSync(BorrowAccountSnapshot)(
      accountSnapshotDto
    );

    it("attaches pool collateral from other reserves and reports account net worth", () => {
      const positions = deriveItems({
        integrationAccountSnapshots: [{ accountSnapshot, integration }],
        markets: [usdcMarket, ghoMarket],
      });

      expect(positions.map((position) => position.id)).toEqual([ghoMarketId]);

      const [ghoPosition] = positions;
      if (!ghoPosition) {
        throw new Error("Expected GHO position");
      }

      expect(ghoPosition.balances.supply).toEqual([
        expect.objectContaining({ marketId: usdcMarketId }),
      ]);
      expect(ghoPosition.metrics.netWorthUsd).toEqual(new BigNumber("0.03"));
      expect(ghoPosition.metrics.netApy).toEqual(new BigNumber("0.026599"));

      const model = getBorrowPositionDetailsModel({ position: ghoPosition, t });
      expect(model.title).toBe("USDC/GHO");
      expect(
        model.metricCards.find((card) => card.id === "net-worth")?.value
      ).toBe("$0.03");
    });

    it("shares pool collateral across debts without double-counting account totals", () => {
      const daiAddress = "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1";
      const daiMarketId = `aave-borrow-arbitrum-${daiAddress.toLowerCase()}`;
      const daiMarket = makePoolMarket(daiMarketId, {
        address: daiAddress,
        decimals: 18,
        name: "DAI",
        symbol: "DAI",
      });
      const positions = deriveBorrowPositions({
        integrationAccountSnapshots: [
          {
            accountSnapshot: Schema.decodeSync(BorrowAccountSnapshot)({
              ...accountSnapshotDto,
              debtBalances: [
                ghoDebt,
                {
                  ...ghoDebt,
                  marketId: daiMarketId,
                  tokenAddress: daiAddress,
                  tokenSymbol: "DAI",
                },
              ],
              netApy: "0.018",
              netWorthUsd: "0.02",
              totalBorrowedUsd: "0.02",
            }),
            integration,
          },
        ],
        markets: [usdcMarket, ghoMarket, daiMarket],
      });

      expect(
        positions.items.map((position) => ({
          collateral: position.balances.supply.map(
            (balance) => balance.marketId
          ),
          id: position.id,
          netWorthUsd: position.metrics.netWorthUsd.toString(),
        }))
      ).toEqual([
        { collateral: [usdcMarketId], id: ghoMarketId, netWorthUsd: "0.02" },
        { collateral: [usdcMarketId], id: daiMarketId, netWorthUsd: "0.02" },
      ]);
      expect(positions.totals).toEqual({
        netApy: new BigNumber("0.018"),
        netApyWeightUsd: new BigNumber("0.02"),
        netWorthUsd: new BigNumber("0.02"),
        totalSuppliedUsd: new BigNumber("0.04"),
      });
    });

    it("projects new borrows over dust collateral whose USD value rounds to zero", () => {
      // Live Aave Ethereum response shape: 103 raw USDC units, priced "0.00".
      const dustSnapshot = Schema.decodeSync(BorrowAccountSnapshot)({
        ...accountSnapshotDto,
        availableToBorrowUsd: "0.00",
        currentLtv: "0.0000",
        debtBalances: [],
        healthFactor: null,
        netApy: "0",
        netWorthUsd: "0.00",
        supplyBalances: [
          {
            ...usdcSupply,
            balance: "0.000103000000000000",
            balanceRaw: "103",
            balanceUsd: "0.00",
          },
        ],
        totalBorrowedUsd: "0.00",
        totalCollateralUsd: "0.00",
        totalSuppliedUsd: "0.00",
      });
      const positions = deriveBorrowPositions({
        integrationAccountSnapshots: [
          { accountSnapshot: dustSnapshot, integration },
        ],
        markets: [usdcMarket, ghoMarket],
      });

      const assessment = positions.riskFor(ghoMarket).assess([
        { amount: new BigNumber("10"), marketId: ghoMarket.id, type: "borrow" },
        {
          amount: new BigNumber("20"),
          tokenId: decodeTokenId(ghoMarket.collateralTokens[0]!.token),
          type: "supply",
        },
      ]);

      expect(assessment.decision).toBe("allow");
      expect(assessment.projection.status).toBe("available");
      if (assessment.projection.status !== "available") return;
      expect(assessment.projection.totalCollateralUsd.toFixed(6)).toBe(
        "20.000103"
      );
      expect(assessment.projection.ltv.toFixed(4)).toBe("0.5000");
    });
  });
});
