import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";
import { Market } from "../../src/domain/borrow/market";
import { TokenBalancesResponse } from "../../src/domain/schema/financial-models";
import {
  deriveBorrowMarketWalletBalances,
  deriveBorrowTokenWalletBalance,
} from "../../src/features/borrow/state";

const market = Schema.decodeUnknownSync(Market)({
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
});

const balances = Schema.decodeUnknownSync(TokenBalancesResponse)([
  {
    token: {
      network: "ethereum",
      address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
    },
    amount: "123.45",
    availableYields: [],
  },
  {
    token: {
      network: "ethereum",
      address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
    },
    amount: "0.25",
    availableYields: [],
  },
  {
    token: {
      network: "polygon",
      address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
    },
    amount: "999",
    availableYields: [],
  },
]);

describe("borrow balance adapter", () => {
  it("derives loan and collateral balances from existing token scans", () => {
    const walletBalances = deriveBorrowMarketWalletBalances({
      balances,
      market,
    });

    expect(walletBalances.loanToken.amount).toBe("123.45");
    expect(walletBalances.loanToken.amountValue.toString()).toBe("123.45");
    expect(walletBalances.collateralTokens[0]?.amount).toBe("0.25");
    expect(walletBalances.selectedCollateralToken?.token.symbol).toBe("WETH");
  });

  it("selects collateral balances by address and ignores other networks", () => {
    const walletBalances = deriveBorrowMarketWalletBalances({
      balances,
      market,
      selectedCollateralTokenAddress:
        "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    });

    expect(walletBalances.selectedCollateralToken?.amount).toBe("0.25");
    expect(walletBalances.loanToken.balance?.token.network).toBe("ethereum");
  });

  it("returns zero for missing balances", () => {
    const balance = deriveBorrowTokenWalletBalance({
      balances,
      network: "base",
      token: market.loanToken,
    });

    expect(balance.amount).toBe("0");
    expect(balance.amountValue.isZero()).toBe(true);
    expect(balance.balance).toBeNull();
  });
});
