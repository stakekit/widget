import { DateTime, Schema } from "effect";
import { describe, expect, it } from "vitest";
import type { ActionTransaction } from "../../../src/domain/action/models";
import { Market } from "../../../src/domain/borrow/catalog/market";
import { BorrowActivityAction } from "../../../src/domain/borrow/responses";
import { TransactionHash } from "../../../src/domain/identity/identifiers";
import type {
  BorrowActivityItem,
  YieldActivityItem,
} from "../../../src/features/activity/model/activity-action";
import { projectActivityActionDetails } from "../../../src/features/activity/model/activity-action-details";
import {
  yieldApiActionFixture,
  yieldApiTransactionFixture,
  yieldApiYieldFixture,
} from "../../fixtures";

const makeItem = (
  overrides: Parameters<typeof yieldApiActionFixture>[0] = {},
  withYield = true
): YieldActivityItem => {
  const yieldData = yieldApiYieldFixture();
  return {
    _tag: "yield",
    actionData: yieldApiActionFixture({
      yieldId: yieldData.id,
      ...overrides,
    }),
    validatorsData: [],
    walletScope: {} as never,
    yieldData: withYield ? yieldData : null,
  };
};

const presentationTime = {
  now: DateTime.makeUnsafe("2026-08-27T10:00:00.000Z"),
  timeZone: DateTime.zoneMakeNamedUnsafe("UTC"),
};

describe("Activity action details projection", () => {
  it("projects a receipt with transactions in step order", () => {
    const supply = yieldApiTransactionFixture({
      id: "supply",
      status: "FAILED",
      stepIndex: 1,
      type: "SUPPLY",
    });
    const approval = yieldApiTransactionFixture({
      broadcastedAt: DateTime.makeUnsafe("2026-08-26T10:05:00.000Z"),
      hash: TransactionHash.make("0xabc"),
      id: "approval",
      status: "CONFIRMED",
      stepIndex: 0,
      type: "APPROVAL",
    });
    const view = projectActivityActionDetails({
      item: makeItem({
        amount: "1000000000000000.123456789",
        createdAt: DateTime.makeUnsafe("2026-08-26T10:00:00.000Z"),
        status: "FAILED",
        transactions: [supply, approval],
        type: "UNSTAKE",
      }),
      locale: "en-US",
      presentationTime,
    });

    expect(view).toMatchObject({
      amount: "-1,000,000,000,000,000.12",
      canContinue: false,
      statusLabel: "failed",
      transactions: [
        {
          broadcastedAt: "Aug 26, 2026, 10:05 AM",
          hash: "0xabc",
          id: "approval",
          status: "confirmed",
          type: "APPROVAL",
        },
        { broadcastedAt: null, id: "supply", status: "failed", type: "SUPPLY" },
      ],
      transactionsSummary: { _tag: "failed", count: 1 },
    });
  });

  it("rounds the amount down with the Widget language separators", () => {
    const view = projectActivityActionDetails({
      item: makeItem({ amount: "1234.56789", type: "STAKE" }),
      locale: "fr",
      presentationTime,
    });

    // French groups digits with U+202F and uses a decimal comma.
    expect(view.amount).toBe("+1\u202f234,56");
  });

  it("orders steps without a step index last, then by creation time", () => {
    const withoutStepIndex = ({
      stepIndex: _stepIndex,
      ...transaction
    }: ActionTransaction): ActionTransaction => transaction;
    const later = withoutStepIndex(
      yieldApiTransactionFixture({
        createdAt: DateTime.makeUnsafe("2026-08-26T10:02:00.000Z"),
        id: "later",
      })
    );
    const earlier = withoutStepIndex(
      yieldApiTransactionFixture({
        createdAt: DateTime.makeUnsafe("2026-08-26T10:01:00.000Z"),
        id: "earlier",
      })
    );
    const indexed = yieldApiTransactionFixture({ id: "indexed", stepIndex: 3 });
    const view = projectActivityActionDetails({
      item: makeItem({ transactions: [later, indexed, earlier] }),
      locale: "en-US",
      presentationTime,
    });

    expect(view.transactions.map(({ id }) => id)).toEqual([
      "indexed",
      "earlier",
      "later",
    ]);
  });

  it.each([
    [["CONFIRMED", "CONFIRMED"], { _tag: "allConfirmed", count: 2 }],
    [["CONFIRMED", "BROADCASTED", "FAILED"], { _tag: "failed", count: 1 }],
    [["CONFIRMED", "BLOCKED"], { _tag: "failed", count: 1 }],
    [["CONFIRMED", "BROADCASTED"], { _tag: "inProgress", count: 1 }],
    [["CONFIRMED", "SKIPPED"], { _tag: "total", count: 2 }],
    [["CONFIRMED", "CREATED"], { _tag: "total", count: 2 }],
  ] as const)("summarizes %j as %j", (statuses, summary) => {
    const view = projectActivityActionDetails({
      item: makeItem({
        transactions: statuses.map((status) =>
          yieldApiTransactionFixture({ status })
        ),
      }),
      locale: "en-US",
      presentationTime,
    });

    expect(view.transactionsSummary).toEqual(summary);
  });

  it("presents an expired waiting action without Continue", () => {
    const view = projectActivityActionDetails({
      item: makeItem({
        createdAt: DateTime.makeUnsafe("2026-08-20T10:00:00.000Z"),
        status: "WAITING_FOR_NEXT",
      }),
      locale: "en-US",
      presentationTime,
    });

    expect(view.statusLabel).toBe("expired");
    expect(view.canContinue).toBe(false);
  });

  it("keeps an action-only receipt when Yield metadata is unavailable", () => {
    const view = projectActivityActionDetails({
      item: makeItem(
        {
          createdAt: DateTime.makeUnsafe("2026-08-27T09:00:00.000Z"),
          status: "WAITING_FOR_NEXT",
        },
        false
      ),
      locale: "en-US",
      presentationTime,
    });

    expect(view.canContinue).toBe(false);
    expect(view.continuationUnavailable).toBe(true);
  });

  it("presents an expired waiting action when Yield metadata is unavailable", () => {
    const view = projectActivityActionDetails({
      item: makeItem(
        {
          createdAt: DateTime.makeUnsafe("2026-08-20T10:00:00.000Z"),
          status: "WAITING_FOR_NEXT",
        },
        false
      ),
      locale: "en-US",
      presentationTime,
    });

    expect(view.statusLabel).toBe("expired");
    expect(view.canContinue).toBe(false);
    expect(view.continuationUnavailable).toBe(false);
  });

  it("projects a Borrow receipt with market, fees, LTV and health factor changes", () => {
    const loanTokenAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
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
            address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
            decimals: 18,
            name: "Wrapped Ether",
            symbol: "WETH",
          },
        },
      ],
      id: "morpho-weth-usdc",
      integrationId: "morpho-borrow",
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
      poolAddress: "0x0000000000000000000000000000000000000001",
      supplyCollateralFeeBps: "0",
      totalBorrow: "500000",
      totalBorrowRaw: "500000000000",
      totalSupply: "1000000",
      totalSupplyRaw: "1000000000000",
      type: "isolated",
      utilizationRate: "0.5",
    });
    const item: BorrowActivityItem = {
      _tag: "borrow",
      actionData: Schema.decodeSync(BorrowActivityAction)({
        action: "supplyAndBorrow",
        address: "0x0000000000000000000000000000000000000001",
        createdAt: "2026-08-26T10:00:00.000Z",
        id: "borrow-action",
        integrationId: "morpho-borrow",
        metadata: {
          currentHealthFactor: null,
          currentLtv: "0",
          feeAmount: "0",
          originationFeeAmount: "1.2",
          predictedHealthFactor: "1.6",
          predictedLtv: "0.5",
        },
        rawArguments: {
          amount: "100",
          marketId: market.id,
          tokenAddress: loanTokenAddress,
        },
        status: "SUCCESS",
        transactions: [
          {
            id: "approval",
            network: "ethereum",
            status: "CONFIRMED",
            type: "APPROVAL",
          },
          {
            id: "bundle",
            network: "ethereum",
            status: "CONFIRMED",
            type: "BUNDLE",
          },
        ],
      }),
      integration: null,
      market,
      network: "ethereum",
      token: market.loanToken,
      walletScope: {} as never,
    };

    expect(
      projectActivityActionDetails({ item, locale: "en-US", presentationTime })
    ).toMatchObject({
      amount: "+100",
      borrow: {
        collateralFee: null,
        healthFactor: "1.6",
        ltv: "0% → 50%",
        market: "WETH / USDC",
        originationFee: "1.2 USDC",
      },
      canContinue: false,
      completedAt: null,
      network: "ethereum",
      statusLabel: "completed",
      tokenSymbol: "USDC",
      transactions: [
        {
          _tag: "borrow",
          explorerUrl: null,
          id: "approval",
          status: "confirmed",
          type: "APPROVAL",
        },
        { _tag: "borrow", id: "bundle", type: "BUNDLE" },
      ],
      transactionsSummary: { _tag: "allConfirmed", count: 2 },
    });
  });
});
