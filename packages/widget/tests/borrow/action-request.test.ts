import BigNumber from "bignumber.js";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import {
  buildBorrowActionRequest,
  buildCollateralToggleActionRequest,
  buildRepayActionRequest,
  buildWithdrawActionRequest,
  decodeBorrowForm,
  Market,
} from "../../src/features/borrow/core";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);

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

const collateralToken = market.collateralTokens[0]!;

describe("borrow action requests", () => {
  it("decodes borrow form variants", () => {
    expect(
      decodeBorrowForm({
        borrowAmount: new BigNumber(25),
        collateralAmount: new BigNumber("0.5"),
        selectedCollateralToken: collateralToken,
        selectedMarket: market,
      })?._tag
    ).toBe("BorrowPlusCollateral");

    expect(
      decodeBorrowForm({
        borrowAmount: new BigNumber(25),
        collateralAmount: new BigNumber(0),
        selectedCollateralToken: null,
        selectedMarket: market,
      })?._tag
    ).toBe("BorrowOnly");

    expect(
      decodeBorrowForm({
        borrowAmount: new BigNumber(0),
        collateralAmount: new BigNumber("0.5"),
        selectedCollateralToken: collateralToken,
        selectedMarket: market,
      })?._tag
    ).toBe("CollateralOnly");

    expect(
      decodeBorrowForm({
        borrowAmount: new BigNumber(0),
        collateralAmount: new BigNumber(0),
        selectedCollateralToken: collateralToken,
        selectedMarket: market,
      })
    ).toBeNull();
  });

  it("builds a borrow-plus-collateral action request", () => {
    const form = decodeBorrowForm({
      borrowAmount: new BigNumber(25),
      collateralAmount: new BigNumber("0.5"),
      selectedCollateralToken: collateralToken,
      selectedMarket: market,
    });

    if (!form) {
      throw new Error("Expected decoded form");
    }

    expect(buildBorrowActionRequest({ address, form })).toEqual({
      action: "borrow",
      address,
      args: {
        amount: "25",
        collateralAmount: "0.5",
        collateralTokenAddress: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        marketId: "aave-v3-ethereum-usdc",
        tokenAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      },
      integrationId: "aave-borrow",
    });
  });

  it("builds collateral-only supply and borrow-only requests", () => {
    const collateralOnly = decodeBorrowForm({
      borrowAmount: 0,
      collateralAmount: "1.25",
      selectedCollateralToken: collateralToken,
      selectedMarket: market,
    });
    const borrowOnly = decodeBorrowForm({
      borrowAmount: "50",
      collateralAmount: 0,
      selectedCollateralToken: null,
      selectedMarket: market,
    });

    if (!collateralOnly || !borrowOnly) {
      throw new Error("Expected decoded forms");
    }

    expect(buildBorrowActionRequest({ address, form: collateralOnly })).toEqual(
      {
        action: "supply",
        address,
        args: {
          amount: "1.25",
          marketId: "aave-v3-ethereum-usdc",
          tokenAddress: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        },
        integrationId: "aave-borrow",
      }
    );
    expect(buildBorrowActionRequest({ address, form: borrowOnly })).toEqual({
      action: "borrow",
      address,
      args: {
        amount: "50",
        marketId: "aave-v3-ethereum-usdc",
        tokenAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      },
      integrationId: "aave-borrow",
    });
  });

  it("builds pending-action requests", () => {
    expect(
      buildRepayActionRequest({
        address,
        integrationId: market.integrationId,
        marketId: market.id,
        repayAll: true,
        tokenAddress: market.loanToken.address,
      })
    ).toEqual({
      action: "repay",
      address,
      args: {
        marketId: "aave-v3-ethereum-usdc",
        repayAll: true,
        tokenAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      },
      integrationId: "aave-borrow",
    });

    expect(
      buildWithdrawActionRequest({
        address,
        amount: "0.25",
        integrationId: market.integrationId,
        marketId: market.id,
        tokenAddress: collateralToken.token.address,
      })
    ).toMatchObject({
      action: "withdraw",
      args: {
        amount: "0.25",
        tokenAddress: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
      },
    });

    expect(
      buildCollateralToggleActionRequest({
        action: "disableCollateral",
        address,
        integrationId: market.integrationId,
        marketId: market.id,
        tokenAddress: collateralToken.token.address,
      })
    ).toMatchObject({
      action: "disableCollateral",
      args: {
        tokenAddress: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
      },
    });
  });
});
