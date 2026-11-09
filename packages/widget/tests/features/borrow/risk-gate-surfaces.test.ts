import { Schema } from "effect";
import { AsyncResult } from "effect/reactivity";
import { describe, expect, it } from "vitest";
import { decodeTokenId } from "../../../src/domain/borrow/ids";
import { deriveBorrowPositions } from "../../../src/domain/borrow/positions/borrow-positions";
import type { RiskGateVerdict } from "../../../src/domain/borrow/risk/risk-gate";
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import type { BorrowActionPreparation } from "../../../src/features/borrow/action-preparation/index";
import {
  BorrowEntryKey,
  resolveBorrowEntryView,
} from "../../../src/features/borrow/borrow-entry/model/borrow-entry";
import {
  resolveBorrowCollateralToggleFormView,
  resolveBorrowWithdrawFormView,
} from "../../../src/features/borrow/market-position/model/action-form";
import { getBorrowPositionActionDescriptors } from "../../../src/features/borrow/market-position/model/details";
import { getBorrowReviewRiskBlock } from "../../../src/features/borrow-transaction-flow/model/review";
import {
  borrowWalletAddress,
  makeBorrowAccountSnapshot,
  makeBorrowIntegration,
  makeBorrowMarket,
  makeBorrowSupplyBalanceDto,
  wethTokenAddress,
} from "../../fixtures/borrow";

const address = Schema.decodeSync(WalletAddress)(borrowWalletAddress);

const integration = makeBorrowIntegration();

// A display-priced pool market: WETH at $2000, max LTV 0.8, liquidation 0.85.
const market = makeBorrowMarket();

// 0.5 WETH ($1000) of collateral against $400 of USDC debt.
const positions = deriveBorrowPositions({
  integrationAccountSnapshots: [
    {
      accountSnapshot: makeBorrowAccountSnapshot({
        availableToBorrowUsd: "400",
        supplyBalances: [
          makeBorrowSupplyBalanceDto({
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
              {
                args: {
                  marketId: market.id,
                  tokenAddress: wethTokenAddress,
                },
                label: "Disable collateral",
                type: "disableCollateral",
              },
            ],
          }),
        ],
        totalCollateralUsd: "1000",
        totalSuppliedUsd: "1000",
      }),
      integration,
    },
  ],
  markets: [market],
});
const position = positions.items[0]!;
const pendingContexts = getBorrowPositionActionDescriptors(position).map(
  (action) => action.pendingContext
);
const withdrawContext = pendingContexts.find(
  (context) => context.type === "withdraw"
);
const disableCollateralContext = pendingContexts.find(
  (context) => context.type === "disableCollateral"
);
if (withdrawContext?.type !== "withdraw") {
  throw new Error("Expected a withdraw action");
}
if (disableCollateralContext?.type !== "disableCollateral") {
  throw new Error("Expected a disable-collateral action");
}

const resolveEntry = (borrowAmount: string) =>
  resolveBorrowEntryView({
    integrationsResult: AsyncResult.success([integration]),
    intent: {
      borrowAmount,
      collateralAmount: "0",
      selectedCollateralTokenId: decodeTokenId(
        market.collateralTokens[0]!.token
      ),
      selectedMarketId: market.id,
    },
    key: new BorrowEntryKey({
      network: "ethereum",
      scope: new WalletScopeKey({ address, network: "ethereum" }),
    }),
    marketsResult: AsyncResult.success([market]),
    positionsResult: AsyncResult.success(positions),
    tokenBalances: [],
  });

const resolveWithdraw = (amount: string) => {
  const view = resolveBorrowWithdrawFormView({
    address,
    context: withdrawContext,
    intent: { amount, selectedTokenAddress: null },
  });
  if (!view) throw new Error("Expected a withdraw form");
  return view;
};

const verdictOf = (
  preparation: BorrowActionPreparation<unknown> | null
): RiskGateVerdict | null =>
  preparation?._tag === "Ready" ? preparation.review.riskVerdict : null;

describe("Risk Gate across Borrow surfaces", () => {
  // Each borrow and withdrawal projects the same debt-to-collateral ratio,
  // so the same LTV and health factor, from the same Risk Position. Max LTV
  // binds only the borrow; the health factor binds both.
  it.each([
    {
      borrowAmount: "100",
      borrowVerdict: { _tag: "Allow" },
      case: "LTV 0.5",
      withdrawAmount: "0.1",
      withdrawVerdict: { _tag: "Allow" },
    },
    {
      borrowAmount: "433.333333",
      borrowVerdict: { _tag: "Warn", warnings: ["RiskCapacityExceeded"] },
      case: "LTV 0.833, within the display tolerance",
      withdrawAmount: "0.26",
      withdrawVerdict: { _tag: "Warn", warnings: ["RiskCapacityExceeded"] },
    },
    {
      borrowAmount: "488.888888",
      borrowVerdict: { _tag: "Block", reason: "ltv" },
      case: "LTV 0.889, past max LTV × 1.05 with a tolerable health factor",
      withdrawAmount: "0.275",
      withdrawVerdict: { _tag: "Warn", warnings: ["RiskCapacityExceeded"] },
    },
    {
      borrowAmount: "550",
      borrowVerdict: { _tag: "Block", reason: "healthFactor" },
      case: "LTV 0.95, health factor × 1.05 below 1",
      withdrawAmount: "0.289474",
      withdrawVerdict: { _tag: "Block", reason: "healthFactor" },
    },
  ] as const)(
    "Entry, withdraw form, and Review agree at $case",
    ({ borrowAmount, borrowVerdict, withdrawAmount, withdrawVerdict }) => {
      const entry = resolveEntry(borrowAmount);
      const withdraw = resolveWithdraw(withdrawAmount);
      const blockOf = (verdict: RiskGateVerdict) =>
        verdict._tag === "Block" ? verdict.reason : null;

      expect(verdictOf(entry.preparation)).toEqual(borrowVerdict);
      expect(verdictOf(withdraw.preparation)).toEqual(withdrawVerdict);

      expect(entry.isActionReady).toBe(borrowVerdict._tag !== "Block");
      expect(withdraw.canSubmit).toBe(withdrawVerdict._tag !== "Block");

      // A block names the limit it crosses; the softer warning is only for
      // overshoots that can still be submitted.
      expect(entry.validation.riskBlock).toBe(blockOf(borrowVerdict));
      expect(entry.validation.riskWarning).toBe(borrowVerdict._tag === "Warn");
      expect(withdraw.riskBlock).toBe(blockOf(withdrawVerdict));
      expect(withdraw.warning).toBe(
        withdrawVerdict._tag === "Warn" ? "withdrawLtv" : null
      );

      if (
        entry.preparation?._tag !== "Ready" ||
        withdraw.preparation._tag !== "Ready"
      ) {
        throw new Error("Expected ready preparations");
      }
      expect(getBorrowReviewRiskBlock(entry.preparation.review)).toBe(
        blockOf(borrowVerdict)
      );
      expect(getBorrowReviewRiskBlock(withdraw.preparation.review)).toBe(
        blockOf(withdrawVerdict)
      );
    }
  );

  it("refuses to submit a collateral toggle the Risk Gate blocks", () => {
    // Disabling the only collateral leaves the $400 debt unbacked.
    const toggle = resolveBorrowCollateralToggleFormView({
      address,
      context: disableCollateralContext,
    });

    expect(verdictOf(toggle.preparation)).toEqual({
      _tag: "Block",
      reason: "healthFactor",
    });
    expect(toggle.canSubmit).toBe(false);
    expect(toggle.riskBlock).toBe("healthFactor");
  });
});
