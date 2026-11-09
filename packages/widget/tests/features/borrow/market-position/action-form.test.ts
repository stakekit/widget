import BigNumber from "bignumber.js";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { TokenAddress } from "../../../../src/domain/borrow/ids";
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
import {
  borrowWalletAddress,
  makeBorrowAccountSnapshot,
  makeBorrowDebtBalanceDto,
  makeBorrowIntegration,
  makeBorrowMarket,
  makeBorrowMarketDto,
  makeBorrowSupplyBalanceDto,
  usdcTokenAddress,
} from "../../../fixtures/borrow";

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
          tokenAddress: Schema.decodeSync(TokenAddress)(
            "0x0000000000000000000000000000000000000001"
          ),
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
  const address = Schema.decodeSync(WalletAddress)(borrowWalletAddress);
  const loanToken = makeBorrowMarketDto().loanToken;
  const integration = makeBorrowIntegration();
  const market = makeBorrowMarket();
  // Interest accrued on top of the borrowed 400 USDC.
  const debt = "400.123456";
  const position = deriveBorrowPositions({
    integrationAccountSnapshots: [
      {
        accountSnapshot: makeBorrowAccountSnapshot({
          availableToBorrowUsd: "400",
          debtBalances: [
            makeBorrowDebtBalanceDto({
              balance: debt,
              balanceRaw: "400123456",
              balanceUsd: "400.12",
              pendingActions: [
                {
                  args: {
                    marketId: market.id,
                    repayAll: true,
                    tokenAddress: usdcTokenAddress,
                  },
                  label: "Repay",
                  type: "repay",
                },
              ],
            }),
          ],
          healthFactor: "2.124",
          netWorthUsd: "599.88",
          supplyBalances: [makeBorrowSupplyBalanceDto()],
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
