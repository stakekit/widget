import BigNumber from "bignumber.js";
import { Schema } from "effect";
import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import { Integration } from "../../../src/domain/borrow/catalog/integration";
import { Market } from "../../../src/domain/borrow/catalog/market";
import {
  decodeTokenId,
  TokenAddress,
  TokenId,
} from "../../../src/domain/borrow/ids";
import { BorrowAccountSnapshot } from "../../../src/domain/borrow/positions/borrow-account-snapshot";
import {
  deriveBorrowPositions,
  emptyBorrowPositions,
} from "../../../src/domain/borrow/positions/borrow-positions";
import { getBorrowPositionDetailsModel } from "../../../src/features/borrow/market-position/model/details";

const t = ((key: string) => key) as TFunction;

const address = "0x0000000000000000000000000000000000000001";
const integrationDto = {
  actions: [],
  id: "aave-borrow",
  metadata: {
    description: "Aave lending and borrowing",
    externalLink: "https://aave.com",
    logoURI: "https://assets.stakek.it/protocols/aave.svg",
  },
  name: "Aave V3",
  networks: ["ethereum"],
  providerId: "aave",
} as const;
const collateralToken = {
  liquidationPenalty: "0.05",
  liquidationThreshold: "0.85",
  maxLtv: "0.8",
  priceUsd: "2000",
  supplyRate: "0.02",
  token: {
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    decimals: 18,
    name: "Wrapped Ether",
    symbol: "WETH",
  },
} as const;
const makeMarket = ({
  id,
  integrationId = integrationDto.id,
  loanTokenAddress,
  loanTokenSymbol,
  type = "pool",
}: {
  readonly id: string;
  readonly integrationId?: string;
  readonly loanTokenAddress: string;
  readonly loanTokenSymbol: string;
  readonly type?: "isolated" | "pool";
}) =>
  Schema.decodeSync(Market)({
    availableLiquidity: "500000",
    availableLiquidityRaw: "500000000000",
    borrowRate: "0.06",
    collateralTokens: [collateralToken],
    feeWrapperAddress: null,
    id,
    integrationId,
    isBorrowEnabled: true,
    loanToken: {
      address: loanTokenAddress,
      decimals: 6,
      name: loanTokenSymbol,
      symbol: loanTokenSymbol,
    },
    loanTokenPriceUsd: "1",
    minLoan: null,
    network: "ethereum",
    originationFeeBps: "0",
    originationFeeWrapperAddress: null,
    blueBundleOriginationFeeBps: null,
    poolAddress: "0x0000000000000000000000000000000000000001",
    supplyCollateralFeeBps: "0",
    totalBorrow: "500000",
    totalBorrowRaw: "500000000000",
    totalSupply: "1000000",
    totalSupplyRaw: "1000000000000",
    type,
    utilizationRate: "0.5",
  });

describe("BorrowPositions", () => {
  it("derives risk when an unselected market advertises native collateral", () => {
    const addressedMarket = makeMarket({
      id: "aave-v3-ethereum-usdc",
      loanTokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      loanTokenSymbol: "USDC",
    });
    const nativeMarket = {
      ...addressedMarket,
      collateralTokens: [
        {
          ...addressedMarket.collateralTokens[0]!,
          token: {
            decimals: 18,
            name: "Ether",
            symbol: "ETH",
          },
        },
      ],
    };

    const positions = deriveBorrowPositions({
      integrationAccountSnapshots: [],
      markets: [nativeMarket],
    });

    expect(positions.riskFor(nativeMarket).current).toMatchObject({
      status: "available",
      totalCollateralUsd: new BigNumber(0),
      totalDebtUsd: new BigNumber(0),
    });
    expect(decodeTokenId({ symbol: "ETH" })).not.toBe(
      decodeTokenId({
        address: addressedMarket.collateralTokens[0]!.token.address,
        symbol: "ETH",
      })
    );
    expect(decodeTokenId({ symbol: "ETH::address::coin" })).not.toBe(
      decodeTokenId({
        address: Schema.decodeSync(TokenAddress)("coin::native"),
        symbol: "ETH",
      })
    );
    expect(() => Schema.decodeUnknownSync(TokenId)("ETH::native")).toThrow();
    expect(() => Schema.decodeSync(TokenId)("address:ETH:")).toThrow();
    expect(() => Schema.decodeSync(TokenId)("native:")).toThrow();
  });

  it("decodes underwater current LTV without hiding the account snapshot", () => {
    const usdcMarket = makeMarket({
      id: "aave-v3-ethereum-usdc",
      loanTokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      loanTokenSymbol: "USDC",
    });

    expect(
      Schema.decodeUnknownSync(BorrowAccountSnapshot)({
        address,
        availableToBorrowUsd: "0",
        currentLtv: "1.2",
        debtBalances: [
          {
            apy: "0.06",
            balance: "1200",
            balanceRaw: "1200000000",
            balanceUsd: "1200",
            marketId: usdcMarket.id,
            pendingActions: [],
            tokenAddress: usdcMarket.loanToken.address,
            tokenSymbol: "USDC",
          },
        ],
        healthFactor: "0.7",
        integrationId: integrationDto.id,
        netApy: "-0.06",
        netWorthUsd: "-200",
        network: "ethereum",
        supplyBalances: [],
        totalBorrowedUsd: "1200",
        totalCollateralUsd: "1000",
        totalSuppliedUsd: "1000",
      }).currentLtv
    ).toEqual(new BigNumber("1.2"));
  });

  it("shares account risk with a pool market that has no local position", () => {
    const usdcMarket = makeMarket({
      id: "aave-v3-ethereum-usdc",
      loanTokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      loanTokenSymbol: "USDC",
    });
    const daiMarket = makeMarket({
      id: "aave-v3-ethereum-dai",
      loanTokenAddress: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      loanTokenSymbol: "DAI",
    });
    const integration = Schema.decodeSync(Integration)(integrationDto);
    const snapshot = Schema.decodeUnknownSync(BorrowAccountSnapshot)({
      address,
      availableToBorrowUsd: "400",
      currentLtv: "0.4",
      debtBalances: [
        {
          apy: "0.06",
          balance: "400",
          balanceRaw: "400000000",
          balanceUsd: "400",
          marketId: usdcMarket.id,
          pendingActions: [],
          tokenAddress: usdcMarket.loanToken.address,
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
          marketId: usdcMarket.id,
          pendingActions: [],
          tokenAddress: collateralToken.token.address,
          tokenSymbol: collateralToken.token.symbol,
        },
      ],
      totalBorrowedUsd: "400",
      totalCollateralUsd: "1000",
      totalSuppliedUsd: "1000",
    });
    const positions = deriveBorrowPositions({
      integrationAccountSnapshots: [{ accountSnapshot: snapshot, integration }],
      markets: [usdcMarket, daiMarket],
    });
    const existing = positions.items.find(
      (position) => position.id === usdcMarket.id
    );
    const newMarketRisk = positions.riskFor(daiMarket);

    expect(existing?.risk).toBe(newMarketRisk);
    expect(newMarketRisk.scope).toBe("account");
    expect(newMarketRisk.current).toMatchObject({
      healthFactor: new BigNumber("2.125"),
      ltv: new BigNumber("0.4"),
      status: "available",
      totalCollateralUsd: new BigNumber(1000),
      totalDebtUsd: new BigNumber(400),
    });

    expect(
      newMarketRisk.assess([
        {
          amount: new BigNumber(200),
          marketId: daiMarket.id,
          type: "borrow",
        },
      ])
    ).toMatchObject({
      decision: "allow",
      projection: {
        ltv: new BigNumber("0.6"),
        status: "available",
        totalCollateralUsd: new BigNumber(1000),
        totalDebtUsd: new BigNumber(600),
      },
    });

    const collateralTokenId = decodeTokenId({
      address: usdcMarket.collateralTokens[0]!.token.address,
      symbol: usdcMarket.collateralTokens[0]!.token.symbol,
    });
    expect(
      newMarketRisk.assess([
        {
          amount: new BigNumber(400),
          marketId: daiMarket.id,
          type: "borrow",
        },
      ])
    ).toMatchObject({ decision: "allow" });
    expect(
      newMarketRisk.assess([
        {
          amount: new BigNumber("400.00000000000000001"),
          marketId: daiMarket.id,
          type: "borrow",
        },
      ])
    ).toMatchObject({
      decision: "block",
      reason: "borrowCapacityExceeded",
    });
    expect(
      newMarketRisk.assess([
        {
          amount: new BigNumber("0.100000000000000001"),
          tokenId: collateralTokenId,
          type: "supply",
        },
        {
          amount: new BigNumber("560.000000000000001"),
          marketId: daiMarket.id,
          type: "borrow",
        },
      ])
    ).toMatchObject({ decision: "allow" });
    expect(
      newMarketRisk.assess([
        {
          amount: new BigNumber("0.250000000000000001"),
          tokenId: collateralTokenId,
          type: "withdraw",
        },
      ])
    ).toMatchObject({
      decision: "block",
      reason: "borrowCapacityExceeded",
    });
    expect(
      newMarketRisk.assess([
        {
          amount: new BigNumber("399.99999999999999999"),
          marketId: usdcMarket.id,
          type: "repay",
        },
        {
          tokenId: collateralTokenId,
          type: "disableCollateral",
        },
      ])
    ).toMatchObject({
      decision: "block",
      reason: "borrowCapacityExceeded",
    });

    const conflictingPositions = deriveBorrowPositions({
      integrationAccountSnapshots: [
        {
          integration,
          accountSnapshot: {
            ...snapshot,
            totalCollateralUsd: new BigNumber(1200),
          },
        },
      ],
      markets: [usdcMarket, daiMarket],
    });
    expect(conflictingPositions.riskFor(usdcMarket).current).toMatchObject({
      reason: "conflictingCollateralTotal",
      status: "unavailable",
    });

    const nonCollateralPositions = deriveBorrowPositions({
      integrationAccountSnapshots: [
        {
          integration,
          accountSnapshot: {
            ...snapshot,
            availableToBorrowUsd: new BigNumber(0),
            currentLtv: new BigNumber(1),
            healthFactor: null,
            supplyBalances: snapshot.supplyBalances.map((balance) => ({
              ...balance,
              isCollateral: false,
            })),
            totalCollateralUsd: new BigNumber(0),
          },
        },
      ],
      markets: [usdcMarket],
    });
    expect(
      nonCollateralPositions.riskFor(usdcMarket).assess([
        {
          amount: new BigNumber(0.1),
          tokenId: decodeTokenId({
            address: usdcMarket.collateralTokens[0]!.token.address,
            symbol: usdcMarket.collateralTokens[0]!.token.symbol,
          }),
          type: "withdraw",
        },
      ])
    ).toMatchObject({
      decision: "allow",
      projection: {
        borrowCapacityUsd: new BigNumber(0),
        status: "available",
        totalDebtUsd: new BigNumber(400),
      },
    });
  });

  it("keeps isolated market risk independent from account totals", () => {
    const usdcMarket = makeMarket({
      id: "morpho-blue-ethereum-weth-usdc",
      integrationId: "morpho-blue-borrow",
      loanTokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      loanTokenSymbol: "USDC",
      type: "isolated",
    });
    const daiMarket = makeMarket({
      id: "morpho-blue-ethereum-weth-dai",
      integrationId: "morpho-blue-borrow",
      loanTokenAddress: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      loanTokenSymbol: "DAI",
      type: "isolated",
    });
    const integration = Schema.decodeSync(Integration)({
      ...integrationDto,
      id: "morpho-blue-borrow",
      name: "Morpho Blue",
      providerId: "morpho-blue",
    });
    const snapshot = Schema.decodeUnknownSync(BorrowAccountSnapshot)({
      address,
      availableToBorrowUsd: null,
      currentLtv: "0.4",
      debtBalances: [
        {
          apy: "0.06",
          balance: "400",
          balanceRaw: "400000000",
          balanceUsd: "400",
          marketId: usdcMarket.id,
          pendingActions: [],
          tokenAddress: usdcMarket.loanToken.address,
          tokenSymbol: "USDC",
        },
      ],
      healthFactor: null,
      integrationId: integration.id,
      netApy: "-0.006",
      netWorthUsd: "1600",
      network: "ethereum",
      supplyBalances: [
        {
          apy: "0.02",
          balance: "1",
          balanceRaw: "1000000000000000000",
          balanceUsd: "2000",
          isCollateral: true,
          marketId: usdcMarket.id,
          pendingActions: [],
          positionState: {
            availableToBorrowUsd: "1200",
            currentLtv: "0.2",
            healthFactor: "4.25",
            liquidationThreshold: "0.85",
          },
          tokenAddress: collateralToken.token.address,
          tokenSymbol: collateralToken.token.symbol,
        },
      ],
      totalBorrowedUsd: "400",
      totalCollateralUsd: "2000",
      totalSuppliedUsd: "2000",
    });
    const positions = deriveBorrowPositions({
      integrationAccountSnapshots: [{ accountSnapshot: snapshot, integration }],
      markets: [usdcMarket, daiMarket],
    });
    const usdcRisk = positions.riskFor(usdcMarket);
    const daiRisk = positions.riskFor(daiMarket);

    expect(usdcRisk).not.toBe(daiRisk);
    expect(usdcRisk.scope).toBe("market");
    expect(usdcRisk.current).toMatchObject({
      healthFactor: new BigNumber("4.25"),
      ltv: new BigNumber("0.2"),
      status: "available",
      totalCollateralUsd: new BigNumber(2000),
      totalDebtUsd: new BigNumber(400),
    });
    expect(daiRisk.current).toMatchObject({
      ltv: new BigNumber(0),
      status: "available",
      totalCollateralUsd: new BigNumber(0),
      totalDebtUsd: new BigNumber(0),
    });

    const conflictingPositions = deriveBorrowPositions({
      integrationAccountSnapshots: [
        {
          integration,
          accountSnapshot: {
            ...snapshot,
            supplyBalances: [
              ...snapshot.supplyBalances,
              {
                ...snapshot.supplyBalances[0]!,
                balance: new BigNumber(0),
                balanceRaw: 0n,
                balanceUsd: new BigNumber(0),
                positionState: {
                  availableToBorrowUsd: new BigNumber(1000),
                  currentLtv: new BigNumber("0.3"),
                  healthFactor: new BigNumber(3),
                  liquidationThreshold: new BigNumber("0.85"),
                },
              },
            ],
          },
        },
      ],
      markets: [usdcMarket],
    });

    expect(conflictingPositions.riskFor(usdcMarket).current).toMatchObject({
      reason: "conflictingPositionState",
      status: "unavailable",
    });
  });

  describe("isolated market valuation", () => {
    const usdcMarket = makeMarket({
      id: "morpho-blue-ethereum-weth-usdc",
      integrationId: "morpho-blue-borrow",
      loanTokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      loanTokenSymbol: "USDC",
      type: "isolated",
    });
    const integration = Schema.decodeSync(Integration)({
      ...integrationDto,
      id: "morpho-blue-borrow",
      name: "Morpho Blue",
      providerId: "morpho-blue",
    });
    const collateralTokenId = decodeTokenId({
      address: usdcMarket.collateralTokens[0]!.token.address,
      symbol: usdcMarket.collateralTokens[0]!.token.symbol,
    });
    const derive = ({
      collateral,
      debt,
      positionState,
    }: {
      readonly collateral: string;
      readonly debt: string;
      readonly positionState: {
        readonly availableToBorrowUsd: string;
        readonly currentLtv: string;
        readonly healthFactor: string | null;
        readonly liquidationThreshold: string;
      };
    }) => {
      // Display valuation: WETH at $2000, USDC at $1.
      const collateralUsd = new BigNumber(collateral).times(2000).toFixed();
      const snapshot = Schema.decodeUnknownSync(BorrowAccountSnapshot)({
        address,
        availableToBorrowUsd: null,
        currentLtv: positionState.currentLtv,
        debtBalances: new BigNumber(debt).isZero()
          ? []
          : [
              {
                apy: "0.06",
                balance: debt,
                balanceRaw: new BigNumber(debt).shiftedBy(6).toFixed(),
                balanceUsd: debt,
                marketId: usdcMarket.id,
                pendingActions: [],
                tokenAddress: usdcMarket.loanToken.address,
                tokenSymbol: "USDC",
              },
            ],
        healthFactor: positionState.healthFactor,
        integrationId: integration.id,
        netApy: "0",
        netWorthUsd: "0",
        network: "ethereum",
        supplyBalances: [
          {
            apy: "0",
            balance: collateral,
            balanceRaw: new BigNumber(collateral).shiftedBy(18).toFixed(),
            balanceUsd: collateralUsd,
            isCollateral: true,
            marketId: usdcMarket.id,
            pendingActions: [],
            positionState,
            tokenAddress: collateralToken.token.address,
            tokenSymbol: collateralToken.token.symbol,
          },
        ],
        totalBorrowedUsd: debt,
        totalCollateralUsd: collateralUsd,
        totalSuppliedUsd: collateralUsd,
      });

      return deriveBorrowPositions({
        integrationAccountSnapshots: [
          { accountSnapshot: snapshot, integration },
        ],
        markets: [usdcMarket],
      });
    };

    // Oracle values 1 WETH at 1600 USDC while display prices it at $2000.
    // LLTV 0.86: LTV = 400 / 1600 = 0.25, HF = 1600 * 0.86 / 400 = 3.44,
    // headroom = 1600 * 0.86 - 400 = 976.
    const anchoredPositionState = {
      availableToBorrowUsd: "976",
      currentLtv: "0.25",
      healthFactor: "3.44",
      liquidationThreshold: "0.86",
    };

    it("projects borrow and withdraw in the oracle valuation of the current position", () => {
      const risk = derive({
        collateral: "1",
        debt: "400",
        positionState: anchoredPositionState,
      }).riskFor(usdcMarket);

      expect(
        risk.assess([
          {
            amount: new BigNumber(400),
            marketId: usdcMarket.id,
            type: "borrow",
          },
        ])
      ).toMatchObject({
        decision: "allow",
        projection: {
          healthFactor: new BigNumber("1.72"),
          ltv: new BigNumber("0.5"),
          maxLtv: new BigNumber("0.86"),
          status: "available",
          totalDebtUsd: new BigNumber(800),
        },
      });
      expect(
        risk.assess([
          {
            amount: new BigNumber("0.5"),
            tokenId: collateralTokenId,
            type: "withdraw",
          },
        ])
      ).toMatchObject({
        decision: "allow",
        projection: {
          healthFactor: new BigNumber("1.72"),
          ltv: new BigNumber("0.5"),
          status: "available",
          totalCollateralUsd: new BigNumber(1000),
        },
      });
    });

    it("blocks borrowing past the oracle liquidation limit even when display prices allow it", () => {
      const risk = derive({
        collateral: "1",
        debt: "400",
        positionState: anchoredPositionState,
      }).riskFor(usdcMarket);

      // Oracle limit: 1600 * 0.86 = 1376 USDC; display limit would be 1600.
      expect(
        risk.assess([
          {
            amount: new BigNumber(976),
            marketId: usdcMarket.id,
            type: "borrow",
          },
        ])
      ).toMatchObject({ decision: "allow" });
      expect(
        risk.assess([
          {
            amount: new BigNumber(1000),
            marketId: usdcMarket.id,
            type: "borrow",
          },
        ])
      ).toMatchObject({
        decision: "block",
        projection: { ltv: new BigNumber("0.875"), status: "available" },
        reason: "borrowCapacityExceeded",
      });
    });

    it("reports no health factor once the debt is fully repaid", () => {
      const risk = derive({
        collateral: "1",
        debt: "400",
        positionState: anchoredPositionState,
      }).riskFor(usdcMarket);

      expect(
        risk.assess([
          {
            amount: new BigNumber(400),
            marketId: usdcMarket.id,
            type: "repay",
          },
        ])
      ).toMatchObject({
        decision: "allow",
        projection: {
          healthFactor: null,
          ltv: new BigNumber(0),
          status: "available",
          totalDebtUsd: new BigNumber(0),
        },
      });
    });

    it("anchors a debt-free position on its borrow headroom", () => {
      // Oracle collateral = 1376 / 0.86 = 1600 USDC.
      const risk = derive({
        collateral: "1",
        debt: "0",
        positionState: {
          availableToBorrowUsd: "1376",
          currentLtv: "0",
          healthFactor: null,
          liquidationThreshold: "0.86",
        },
      }).riskFor(usdcMarket);

      expect(
        risk.assess([
          {
            amount: new BigNumber(400),
            marketId: usdcMarket.id,
            type: "borrow",
          },
        ])
      ).toMatchObject({
        decision: "allow",
        projection: {
          healthFactor: new BigNumber("3.44"),
          ltv: new BigNumber("0.25"),
          status: "available",
        },
      });
    });

    it("leaves projected risk unavailable without an oracle anchor", () => {
      const risk = emptyBorrowPositions.riskFor(usdcMarket);

      expect(risk.current).toMatchObject({
        maxLtv: new BigNumber("0.8"),
        status: "available",
      });
      expect(
        risk.assess([
          {
            amount: new BigNumber(1),
            tokenId: collateralTokenId,
            type: "supply",
          },
          {
            amount: new BigNumber(400),
            marketId: usdcMarket.id,
            type: "borrow",
          },
        ])
      ).toMatchObject({
        decision: "allow",
        projection: {
          reason: "missingRiskAnchor",
          status: "unavailable",
          totalCollateralUsd: new BigNumber(2000),
          totalDebtUsd: new BigNumber(400),
        },
      });
      expect(
        risk.assess([
          {
            amount: new BigNumber(1),
            tokenId: collateralTokenId,
            type: "supply",
          },
          {
            amount: new BigNumber(1601),
            marketId: usdcMarket.id,
            type: "borrow",
          },
        ])
      ).toMatchObject({
        decision: "block",
        projection: { reason: "missingRiskAnchor", status: "unavailable" },
        reason: "borrowCapacityExceeded",
      });

      const debtFreeWithoutHeadroom = derive({
        collateral: "1",
        debt: "0",
        positionState: {
          availableToBorrowUsd: "0",
          currentLtv: "0",
          healthFactor: null,
          liquidationThreshold: "0.86",
        },
      }).riskFor(usdcMarket);
      expect(
        debtFreeWithoutHeadroom.assess([
          {
            amount: new BigNumber(100),
            marketId: usdcMarket.id,
            type: "borrow",
          },
        ]).projection
      ).toMatchObject({ reason: "missingRiskAnchor", status: "unavailable" });
    });

    it("shows the market LLTV as max LTV for an underwater position", () => {
      // Oracle collateral 400 / 0.9 = 444.44 USDC; headroom clamps to zero.
      const positions = derive({
        collateral: "1",
        debt: "400",
        positionState: {
          availableToBorrowUsd: "0",
          currentLtv: "0.9",
          healthFactor: "0.9556",
          liquidationThreshold: "0.86",
        },
      });
      const position = positions.items.find(
        (item) => item.id === usdcMarket.id
      );
      if (!position) {
        throw new Error("Expected isolated position");
      }

      expect(position.risk.current).toMatchObject({
        ltv: new BigNumber("0.9"),
        maxLtv: new BigNumber("0.86"),
        status: "available",
      });
      expect(
        getBorrowPositionDetailsModel({ position, t }).detailRows.find(
          (row) => row.id === "max-ltv"
        )?.value
      ).toBe("86%");
    });
  });

  it("keeps the collateral-weighted max LTV for an underwater pool account", () => {
    const usdcMarket = makeMarket({
      id: "aave-v3-ethereum-usdc",
      loanTokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      loanTokenSymbol: "USDC",
    });
    const integration = Schema.decodeSync(Integration)(integrationDto);
    const snapshot = Schema.decodeUnknownSync(BorrowAccountSnapshot)({
      address,
      availableToBorrowUsd: "0",
      currentLtv: "0.9",
      debtBalances: [
        {
          apy: "0.06",
          balance: "900",
          balanceRaw: "900000000",
          balanceUsd: "900",
          marketId: usdcMarket.id,
          pendingActions: [],
          tokenAddress: usdcMarket.loanToken.address,
          tokenSymbol: "USDC",
        },
      ],
      healthFactor: "0.9444",
      integrationId: integration.id,
      netApy: "-0.06",
      netWorthUsd: "100",
      network: "ethereum",
      supplyBalances: [
        {
          apy: "0.02",
          balance: "0.5",
          balanceRaw: "500000000000000000",
          balanceUsd: "1000",
          isCollateral: true,
          marketId: usdcMarket.id,
          pendingActions: [],
          tokenAddress: collateralToken.token.address,
          tokenSymbol: collateralToken.token.symbol,
        },
      ],
      totalBorrowedUsd: "900",
      totalCollateralUsd: "1000",
      totalSuppliedUsd: "1000",
    });

    expect(
      deriveBorrowPositions({
        integrationAccountSnapshots: [
          { accountSnapshot: snapshot, integration },
        ],
        markets: [usdcMarket],
      }).riskFor(usdcMarket).current
    ).toMatchObject({
      ltv: new BigNumber("0.9"),
      maxLtv: new BigNumber("0.8"),
      status: "available",
    });
  });
});
