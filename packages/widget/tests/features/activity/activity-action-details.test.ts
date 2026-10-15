import { DateTime } from "effect";
import { describe, expect, it } from "vitest";
import type { ActionTransaction } from "../../../src/domain/action/models";
import type { YieldActivityItem } from "../../../src/features/activity/model/activity-action";
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
  it("projects an exact receipt with transactions in step order", () => {
    const supply = yieldApiTransactionFixture({
      id: "supply",
      status: "FAILED",
      stepIndex: 1,
      type: "SUPPLY",
    });
    const approval = yieldApiTransactionFixture({
      broadcastedAt: DateTime.makeUnsafe("2026-08-26T10:05:00.000Z"),
      hash: "0xabc",
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
      amount: "-1,000,000,000,000,000.123456789",
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

  it("shows the exact amount with the Widget language separators", () => {
    const view = projectActivityActionDetails({
      item: makeItem({ amount: "1234.000000000000000001", type: "STAKE" }),
      locale: "fr",
      presentationTime,
    });

    // French groups digits with U+202F and uses a decimal comma.
    expect(view.amount).toBe("+1\u202f234,000000000000000001");
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
});
