import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";

import { BorrowToken } from "../../../../src/domain/borrow/token";
import { TokenBalancesResponse } from "../../../../src/domain/finance/models";
import {
  deriveBorrowMarketWalletBalances,
  deriveBorrowTokenWalletBalance,
} from "../../../../src/features/borrow/action-preparation/model/wallet-balances";
import { makeBorrowMarket } from "../../../fixtures/borrow";

const market = makeBorrowMarket();

const balances = Schema.decodeSync(TokenBalancesResponse)([
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

  it("matches addressed tokens by contract when scan symbols differ", () => {
    const scanBalances = Schema.decodeSync(TokenBalancesResponse)([
      {
        amount: "0.0009698",
        availableYields: [],
        token: {
          address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
          decimals: 18,
          name: "Wrapped Ether",
          network: "arbitrum",
          symbol: "wETH",
        },
      },
      {
        amount: "0.02994",
        availableYields: [],
        token: {
          address: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
          decimals: 6,
          name: "Tether USD",
          network: "arbitrum",
          symbol: "USDT",
        },
      },
    ]);

    const weth = deriveBorrowTokenWalletBalance({
      balances: scanBalances,
      network: "arbitrum",
      token: Schema.decodeSync(BorrowToken)({
        address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        decimals: 18,
        name: "WETH",
        symbol: "WETH",
      }),
    });
    const usdt0 = deriveBorrowTokenWalletBalance({
      balances: scanBalances,
      network: "arbitrum",
      token: Schema.decodeSync(BorrowToken)({
        address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
        decimals: 6,
        name: "USD₮0",
        symbol: "USDT0",
      }),
    });

    expect(weth.amount).toBe("0.0009698");
    expect(usdt0.amount).toBe("0.02994");
  });

  it("does not match an addressed token against a native balance", () => {
    const nativeBalances = Schema.decodeSync(TokenBalancesResponse)([
      {
        amount: "2",
        availableYields: [],
        token: {
          decimals: 18,
          name: "Ether",
          network: "ethereum",
          symbol: "WETH",
        },
      },
    ]);
    const balance = deriveBorrowTokenWalletBalance({
      balances: nativeBalances,
      network: "ethereum",
      token: market.collateralTokens[0]!.token,
    });

    expect(balance.balance).toBeNull();
  });

  it("does not fold native token symbol casing", () => {
    const nativeBalances = Schema.decodeSync(TokenBalancesResponse)([
      {
        amount: "2",
        availableYields: [],
        token: {
          decimals: 18,
          name: "Ether",
          network: "ethereum",
          symbol: "eth",
        },
      },
    ]);
    const balance = deriveBorrowTokenWalletBalance({
      balances: nativeBalances,
      network: "ethereum",
      token: {
        decimals: 18,
        name: "Ether",
        symbol: "ETH",
      },
    });

    expect(balance.balance).toBeNull();
    expect(balance.amount).toBe("0");
  });
});
