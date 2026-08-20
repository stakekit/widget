import BigNumber from "bignumber.js";
import * as Schema from "effect/Schema";
import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import { Integration } from "../../../src/domain/borrow/catalog/integration";
import { Market } from "../../../src/domain/borrow/catalog/market";
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

const positionDto = Schema.decodeUnknownSync(BorrowAccountSnapshot)({
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
      marketId: marketDto.id,
      pendingActions: [
        {
          args: {
            amountRaw: "500000000000000000",
            marketId: marketDto.id,
            tokenAddress: marketDto.collateralTokens[0].token.address,
          },
          label: "Withdraw",
          type: "withdraw",
        },
        {
          args: {
            marketId: marketDto.id,
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
          integration: Schema.decodeUnknownSync(Integration)(integrationDto),
          accountSnapshot: positionDto,
        },
      ],
      markets: [Schema.decodeUnknownSync(Market)(marketDto)],
    });

    expect(position?.id).toBe("aave-v3-ethereum-usdc");
    expect(position?.balances.debt?.balance).toBe(400);
    expect(position?.balances.supply).toHaveLength(1);
    expect(position?.risk.current).toMatchObject({
      healthFactor: 2.125,
      ltv: 0.4,
      status: "available",
    });
  });

  it("builds semantic descriptors for borrow position pending actions", () => {
    const [position] = deriveItems({
      integrationAccountSnapshots: [
        {
          integration: Schema.decodeUnknownSync(Integration)(integrationDto),
          accountSnapshot: positionDto,
        },
      ],
      markets: [Schema.decodeUnknownSync(Market)(marketDto)],
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

  it("derives borrow position details model from local position data", () => {
    const [position] = deriveItems({
      integrationAccountSnapshots: [
        {
          integration: Schema.decodeUnknownSync(Integration)(integrationDto),
          accountSnapshot: positionDto,
        },
      ],
      markets: [Schema.decodeUnknownSync(Market)(marketDto)],
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
    expect(model.currentLtv).toBe(0.4);
    expect(model.healthFactor).toBe(2.125);
    expect(model.liquidationThreshold).toBe(0.85);
    expect(model.collateralItems).toEqual([
      expect.objectContaining({
        isCollateral: true,
        label: "WETH",
      }),
    ]);
  });

  it("shows only borrowing metrics on the entry details screen", () => {
    const market = Schema.decodeUnknownSync(Market)(marketDto);
    const integration = Schema.decodeUnknownSync(Integration)(integrationDto);
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

  it("keeps same-token collateral isolated by market and preserves API risk state", () => {
    const collateralAddress = "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf";
    const usdcMarketId = "morpho-blue-borrow-ethereum-cbbtc-usdc";
    const usdtMarketId = "morpho-blue-borrow-ethereum-cbbtc-usdt";
    const morphoIntegration = Schema.decodeUnknownSync(Integration)({
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
      Schema.decodeUnknownSync(Market)({
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
    const accountPosition = Schema.decodeUnknownSync(BorrowAccountSnapshot)({
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
        balanceUsd: 2.54,
        marketId: usdcMarket.id,
      }),
    ]);
    expect(usdcPosition?.metrics.totalCollateralUsd).toBe(2.54);
    expect(usdcPosition?.metrics.totalBorrowedUsd).toBe(0.5);
    expect(usdcPosition?.risk.current).toMatchObject({
      healthFactor: 4.3708,
      ltv: 0.1968,
      status: "available",
    });
    expect(usdcPosition?.metrics.borrowApy).toBeCloseTo(0.0385665);

    if (!usdcPosition) {
      throw new Error("Expected USDC position");
    }

    const model = getBorrowPositionDetailsModel({ position: usdcPosition, t });
    expect(model.providerName).toBe("Morpho Blue");
    expect(model.healthFactor).toBe(4.3708);
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
});
