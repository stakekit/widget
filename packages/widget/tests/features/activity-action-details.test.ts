import { DateTime } from "effect";
import { describe, expect, it } from "vitest";
import type { ActivityActionItem } from "../../src/features/activity/model/activity-action";
import { projectActivityActionDetails } from "../../src/features/activity/model/activity-action-details";
import {
  yieldApiActionFixture,
  yieldApiTransactionFixture,
  yieldApiYieldFixture,
} from "../fixtures";

const makeItem = (
  overrides: Parameters<typeof yieldApiActionFixture>[0] = {},
  withYield = true
): ActivityActionItem => {
  const yieldData = yieldApiYieldFixture();
  return {
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
  it("projects an exact receipt and keeps backend transaction order", () => {
    const first = yieldApiTransactionFixture({
      id: "transaction-b",
      status: "FAILED",
      title: "Stake",
    });
    const second = yieldApiTransactionFixture({
      id: "transaction-a",
      status: "SKIPPED",
      title: "Approval",
    });
    const view = projectActivityActionDetails({
      item: makeItem({
        amount: "1000000000000000.123456789",
        createdAt: DateTime.makeUnsafe("2026-08-26T10:00:00.000Z"),
        status: "FAILED",
        transactions: [first, second],
        type: "UNSTAKE",
      }),
      locale: "en-US",
      presentationTime,
    });

    expect(view).toMatchObject({
      amount: "-1000000000000000.123456789",
      canContinue: false,
      statusLabel: "failed",
      transactions: [
        { id: "transaction-b", title: "Stake" },
        { id: "transaction-a", title: "Approval" },
      ],
    });
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
