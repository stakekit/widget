import { Schema } from "effect";
import { AsyncResult } from "effect/reactivity";
import { describe, expect, it } from "vitest";
import { Integration } from "../../../src/domain/borrow/catalog/integration";
import { Market } from "../../../src/domain/borrow/catalog/market";
import { decodeTokenId } from "../../../src/domain/borrow/ids";
import { BorrowAccountSnapshot } from "../../../src/domain/borrow/positions/borrow-account-snapshot";
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
import { getBorrowReviewRiskBlock } from "../../../src/features/borrow-transaction-flow/model/borrow-transaction-flow";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const loanTokenAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
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

// A display-priced pool market: WETH at $2000, max LTV 0.8, liquidation 0.85.
const market = Schema.decodeSync(Market)({
  availableLiquidity: "500000",
  availableLiquidityRaw: "500000000000",
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
  loanToken: {
    address: loanTokenAddress,
    decimals: 6,
    name: "USD Coin",
    symbol: "USDC",
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
  type: "pool",
  utilizationRate: "0.5",
});

// 0.5 WETH ($1000) of collateral against $400 of USDC debt.
const positions = deriveBorrowPositions({
  integrationAccountSnapshots: [
    {
      accountSnapshot: Schema.decodeSync(BorrowAccountSnapshot)({
        address,
        availableToBorrowUsd: "400",
        currentLtv: "0.4",
        debtBalances: [
          {
            apy: "0.06",
            balance: "400",
            balanceRaw: "400000000",
            balanceUsd: "400",
            marketId: market.id,
            pendingActions: [],
            tokenAddress: loanTokenAddress,
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
            marketId: market.id,
            pendingActions: [
              {
                args: {
                  amountRaw: "500000000000000000",
                  marketId: market.id,
                  tokenAddress: collateralTokenAddress,
                },
                label: "Withdraw",
                type: "withdraw",
              },
              {
                args: {
                  marketId: market.id,
                  tokenAddress: collateralTokenAddress,
                },
                label: "Disable collateral",
                type: "disableCollateral",
              },
            ],
            tokenAddress: collateralTokenAddress,
            tokenSymbol: "WETH",
          },
        ],
        totalBorrowedUsd: "400",
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
  // so the same LTV and health factor, from the same Risk Position.
  it.each([
    {
      borrowAmount: "100",
      case: "LTV 0.5",
      verdict: { _tag: "Allow" },
      withdrawAmount: "0.1",
    },
    {
      borrowAmount: "433.333333",
      case: "LTV 0.833, within the display tolerance",
      verdict: { _tag: "Warn", warnings: ["RiskCapacityExceeded"] },
      withdrawAmount: "0.26",
    },
    {
      borrowAmount: "488.888888",
      case: "LTV 0.889, past max LTV × 1.05",
      verdict: { _tag: "Block", reason: "ltv" },
      withdrawAmount: "0.275",
    },
  ] as const)(
    "Entry, withdraw form, and Review agree at $case",
    ({ borrowAmount, verdict, withdrawAmount }) => {
      const entry = resolveEntry(borrowAmount);
      const withdraw = resolveWithdraw(withdrawAmount);
      const blocked = verdict._tag === "Block";
      const warned = verdict._tag === "Warn";
      const riskBlock = verdict._tag === "Block" ? verdict.reason : null;

      expect(verdictOf(entry.preparation)).toEqual(verdict);
      expect(verdictOf(withdraw.preparation)).toEqual(verdict);

      expect(entry.isActionReady).toBe(!blocked);
      expect(withdraw.canSubmit).toBe(!blocked);

      // A block names the limit it crosses; the softer warning is only for
      // overshoots that can still be submitted.
      expect(entry.validation.riskBlock).toBe(riskBlock);
      expect(entry.validation.riskWarning).toBe(warned);
      expect(withdraw.riskBlock).toBe(riskBlock);
      expect(withdraw.warning).toBe(warned ? "withdrawLtv" : null);

      if (
        entry.preparation?._tag !== "Ready" ||
        withdraw.preparation._tag !== "Ready"
      ) {
        throw new Error("Expected ready preparations");
      }
      expect(getBorrowReviewRiskBlock(entry.preparation.review)).toBe(
        riskBlock
      );
      expect(getBorrowReviewRiskBlock(withdraw.preparation.review)).toBe(
        riskBlock
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
