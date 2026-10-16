import BigNumber from "bignumber.js";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { Integration } from "../../../../src/domain/borrow/catalog/integration";
import { Market } from "../../../../src/domain/borrow/catalog/market";
import { BorrowAccountSnapshot } from "../../../../src/domain/borrow/positions/borrow-account-snapshot";
import { deriveBorrowPositions } from "../../../../src/domain/borrow/positions/borrow-positions";
import {
  type TokenBalance,
  TokenBalancesResponse,
} from "../../../../src/domain/finance/models";
import { WalletAddress } from "../../../../src/domain/identity/identifiers";
import {
  applyBorrowRepayFormAction,
  applyBorrowWithdrawFormAction,
  makeDefaultBorrowRepayFormIntent,
  makeDefaultBorrowWithdrawFormIntent,
  resolveBorrowRepayFormView,
} from "../../../../src/features/borrow/market-position/model/action-form";

describe("Borrow position action form intent", () => {
  it("normalizes and resets repayment intent", () => {
    const changed = applyBorrowRepayFormAction({
      action: { amount: "100.500", type: "amount/set" },
      intent: makeDefaultBorrowRepayFormIntent(),
    });
    const repayAll = applyBorrowRepayFormAction({
      action: { repayAll: true, type: "repayAll/set" },
      intent: changed,
    });

    expect(repayAll).toEqual({ amount: "100.5", repayAll: true });
    expect(
      applyBorrowRepayFormAction({
        action: { type: "reset" },
        intent: repayAll,
      })
    ).toEqual(makeDefaultBorrowRepayFormIntent());
  });

  it("clears a withdrawal amount when the selected token changes", () => {
    const changed = applyBorrowWithdrawFormAction({
      action: { amount: "0.25", type: "amount/set" },
      intent: makeDefaultBorrowWithdrawFormIntent(),
    });

    expect(
      applyBorrowWithdrawFormAction({
        action: {
          tokenAddress: "0x0000000000000000000000000000000000000001",
          type: "token/select",
        },
        intent: changed,
      })
    ).toEqual({
      amount: "0",
      selectedTokenAddress: "0x0000000000000000000000000000000000000001",
    });
  });
});

describe("Borrow repay form view", () => {
  const address = Schema.decodeSync(WalletAddress)(
    "0x0000000000000000000000000000000000000001"
  );
  const loanToken = {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimals: 6,
    name: "USD Coin",
    symbol: "USDC",
  };
  const collateralTokenAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const integration = Schema.decodeSync(Integration)({
    id: "aave-borrow",
    metadata: {
      description: "Aave lending and borrowing",
      externalLink: "https://aave.com",
      logoURI: "https://assets.stakek.it/protocols/aave.svg",
    },
    name: "Aave V3",
    networks: ["ethereum"],
  });
  const market = Schema.decodeSync(Market)({
    availableLiquidity: "500000",
    availableLiquidityRaw: "500000000000",
    blueBundleOriginationFeeBps: null,
    borrowRate: "0.06",
    collateralTokens: [
      {
        liquidationPenalty: "0.05",
        liquidationThreshold: "0.85",
        maxLtv: "0.8",
        priceUsd: "2000",
        supplyRate: "0.02",
        token: {
          address: collateralTokenAddress,
          decimals: 18,
          name: "Wrapped Ether",
          symbol: "WETH",
        },
      },
    ],
    id: "aave-v3-ethereum-usdc",
    integrationId: integration.id,
    isBorrowEnabled: true,
    loanToken,
    loanTokenPriceUsd: "1",
    minLoan: null,
    network: "ethereum",
    originationFeeBps: "0",
    originationFeeWrapperAddress: null,
    poolAddress: "0x0000000000000000000000000000000000000001",
    supplyCollateralFeeBps: "0",
    totalBorrow: "500000",
    totalBorrowRaw: "500000000000",
    totalSupply: "1000000",
    totalSupplyRaw: "1000000000000",
    type: "pool",
    utilizationRate: "0.5",
  });
  // Interest accrued on top of the borrowed 400 USDC.
  const debt = "400.123456";
  const position = deriveBorrowPositions({
    integrationAccountSnapshots: [
      {
        accountSnapshot: Schema.decodeSync(BorrowAccountSnapshot)({
          address,
          availableToBorrowUsd: "400",
          currentLtv: "0.4",
          debtBalances: [
            {
              apy: "0.06",
              balance: debt,
              balanceRaw: "400123456",
              balanceUsd: "400.12",
              marketId: market.id,
              pendingActions: [
                {
                  args: {
                    marketId: market.id,
                    repayAll: true,
                    tokenAddress: loanToken.address,
                  },
                  label: "Repay",
                  type: "repay",
                },
              ],
              tokenAddress: loanToken.address,
              tokenSymbol: "USDC",
            },
          ],
          healthFactor: "2.124",
          integrationId: integration.id,
          netApy: "-0.006",
          netWorthUsd: "599.88",
          network: "ethereum",
          supplyBalances: [
            {
              apy: "0.02",
              balance: "0.5",
              balanceRaw: "500000000000000000",
              balanceUsd: "1000",
              isCollateral: true,
              marketId: market.id,
              pendingActions: [],
              tokenAddress: collateralTokenAddress,
              tokenSymbol: "WETH",
            },
          ],
          totalBorrowedUsd: "400.12",
          totalCollateralUsd: "1000",
          totalSuppliedUsd: "1000",
        }),
        integration,
      },
    ],
    markets: [market],
  }).items[0]!;
  const context = {
    action: position.actions.debt.find((action) => action.type === "repay")!,
    debtBalance: position.balances.debt!,
    position,
    type: "repay" as const,
  };
  const walletHolding = (amount: string) =>
    Schema.decodeSync(TokenBalancesResponse)([
      {
        amount,
        availableYields: [],
        token: { ...loanToken, network: "ethereum" },
      },
    ]);
  const repayAllView = (tokenBalances: ReadonlyArray<TokenBalance> | null) =>
    resolveBorrowRepayFormView({
      address,
      context,
      intent: { amount: "0", repayAll: true },
      tokenBalances,
    });

  it("shows the outstanding debt as the amount when repaying in full", () => {
    expect(repayAllView(walletHolding("500")).amount).toEqual(
      new BigNumber(debt)
    );
  });

  it("warns but submits a full repayment the wallet balance falls short of", () => {
    // Holding exactly the borrowed amount leaves accrued interest unpaid. The
    // scanned balance can be stale; the API rechecks the live balance.
    expect(repayAllView(walletHolding("400"))).toMatchObject({
      canSubmit: true,
      warning: "walletBalance",
    });
  });

  it.each([
    ["covers the debt exactly", walletHolding(debt)],
    ["has an unknown balance", null],
  ] as const)(
    "does not warn on a full repayment when the wallet %s",
    (_, tokenBalances) => {
      expect(repayAllView(tokenBalances)).toMatchObject({
        canSubmit: true,
        warning: null,
      });
    }
  );
});
