import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";
import { Market } from "../../src/domain/borrow/market";
import {
  getBorrowNetworkForChainId,
  isBorrowNetwork,
} from "../../src/domain/borrow/network";
import { Position } from "../../src/domain/borrow/position";
import { projectLtvRatio } from "../../src/domain/borrow/position-projection";

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

const repayPendingAction = {
  type: "repay",
  label: "Repay",
  args: {
    tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    marketId: marketDto.id,
  },
} as const;

const withdrawPendingAction = {
  type: "withdraw",
  label: "Withdraw",
  args: {
    amountRaw: "1000000000000000000",
    tokenAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    marketId: marketDto.id,
  },
} as const;

const positionDto = {
  id: marketDto.id,
  market: marketDto,
  integration: integrationDto,
  debtBalance: {
    marketId: marketDto.id,
    tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    tokenSymbol: "USDC",
    balance: "400",
    balanceRaw: "400000000",
    balanceUsd: "400",
    apy: "0.06",
    pendingActions: [repayPendingAction],
  },
  supplyBalances: [
    {
      marketId: marketDto.id,
      tokenAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      tokenSymbol: "WETH",
      balance: "0.5",
      balanceRaw: "500000000000000000",
      balanceUsd: "1000",
      apy: "0.02",
      isCollateral: true,
      pendingActions: [withdrawPendingAction],
    },
  ],
  debtPendingActions: [repayPendingAction],
  positionState: null,
  supplyPendingActions: [withdrawPendingAction],
} as const;

describe("borrow domain", () => {
  it("decodes markets and derives risk values", () => {
    const market = Schema.decodeUnknownSync(Market)(marketDto);

    expect(market.loanToken.address).toBe(
      "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
    );
    expect(market.getMaxLtv()).toBe(0.8);
    expect(market.getLiquidationThreshold()).toBe(0.85);
    expect(market.getLiquidationPenalty()).toBe(0.05);
  });

  it("decodes positions and derives balances, LTV, health, and net APY", () => {
    const position = Schema.decodeUnknownSync(Position)(positionDto);

    expect(position.getMeta()).toEqual({ name: "WETH/USDC", symbol: "WETH" });
    expect(position.getTotalCollateralUsd()).toBe(1000);
    expect(position.getTotalBorrowedUsd()).toBe(400);
    expect(position.getCurrentLtv()).toBe(0.4);
    expect(position.getHealthFactor()).toBe(2.125);
    expect(position.getNetWorthUsd()).toBe(600);
    expect(position.getNetApy()).toBeCloseTo(-0.006_666, 5);

    const supplyPendingAction = position.supplyPendingActions[0];
    expect(supplyPendingAction?.type).toBe("withdraw");
    if (supplyPendingAction?.type !== "withdraw") {
      throw new Error("Expected withdraw pending action");
    }
    expect(supplyPendingAction.args.amountRaw).toBe(1_000_000_000_000_000_000n);
  });

  it("supports initial borrow network scope", () => {
    expect(getBorrowNetworkForChainId(1)).toBe("ethereum");
    expect(getBorrowNetworkForChainId(8453)).toBe("base");
    expect(getBorrowNetworkForChainId(42161)).toBe("arbitrum");
    expect(getBorrowNetworkForChainId(10)).toBe("optimism");
    expect(getBorrowNetworkForChainId(137)).toBeNull();
    expect(isBorrowNetwork("polygon")).toBe(false);
  });

  it("projects LTV ratios and formats borrow values", () => {
    expect(projectLtvRatio({ collateralUsd: 1000, debtUsd: 250 })).toBe(0.25);
    expect(projectLtvRatio({ collateralUsd: 100, debtUsd: 250 })).toBe(100);
    expect(projectLtvRatio({ collateralUsd: 0, debtUsd: 1 })).toBe(100);
  });
});
