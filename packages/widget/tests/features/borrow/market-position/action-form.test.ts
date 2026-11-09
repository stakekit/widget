import BigNumber from "bignumber.js";
import { Schema } from "effect";
import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";

import { deriveBorrowPositions } from "../../../../src/domain/borrow/borrow-positions";
import { TokenAddress } from "../../../../src/domain/borrow/ids";
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
  resolveBorrowWithdrawFormView,
} from "../../../../src/features/borrow/market-position/model/action-form";
import {
  getBorrowPositionActionDescriptors,
  getBorrowPositionDetailsModel,
} from "../../../../src/features/borrow/market-position/model/details";
import {
  borrowWalletAddress,
  makeBorrowAccountSnapshot,
  makeBorrowDebtBalanceDto,
  makeBorrowIntegration,
  makeBorrowMarket,
  makeBorrowMarketDto,
  makeBorrowSupplyBalanceDto,
  usdcTokenAddress,
  wethTokenAddress,
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

describe("Borrow withdraw form without projected risk", () => {
  // The collateral is priced at $0, so the position's risk can't be computed.
  const market = makeBorrowMarket();
  const position = deriveBorrowPositions({
    integrationAccountSnapshots: [
      {
        accountSnapshot: makeBorrowAccountSnapshot({
          supplyBalances: [
            makeBorrowSupplyBalanceDto({
              balanceUsd: "0",
              pendingActions: [
                {
                  args: {
                    amountRaw: "500000000000000000",
                    marketId: market.id,
                    tokenAddress: wethTokenAddress,
                  },
                  label: "Withdraw",
                  type: "withdraw",
                },
              ],
            }),
          ],
          totalCollateralUsd: "0",
          totalSuppliedUsd: "0",
        }),
        integration: makeBorrowIntegration(),
      },
    ],
    markets: [market],
  }).items[0]!;

  it("hides the health factor and loan to value from the position summary", () => {
    const model = getBorrowPositionDetailsModel({
      locale: "en",
      position,
      t: ((key: string) => key) as TFunction,
    });

    expect(model.summary.metrics.map((metric) => metric.id)).toEqual(["debt"]);
    expect(model.currentLtv).toBeNull();
  });

  it("warns past the withdrawable balance without blocking review", () => {
    const context = getBorrowPositionActionDescriptors(position)
      .map((action) => action.pendingContext)
      .find((candidate) => candidate.type === "withdraw");
    if (context?.type !== "withdraw") {
      throw new Error("Expected a withdraw action");
    }

    expect(
      resolveBorrowWithdrawFormView({
        address: Schema.decodeSync(WalletAddress)(borrowWalletAddress),
        context,
        intent: { amount: "0.6", selectedTokenAddress: null },
      })
    ).toMatchObject({
      canSubmit: true,
      riskBlock: null,
      riskStatus: "unavailable",
      warning: "withdrawBalance",
    });
  });
});
