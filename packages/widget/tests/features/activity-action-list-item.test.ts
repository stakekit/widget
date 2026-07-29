import { DateTime } from "effect";
import { describe, expect, it } from "vitest";
import type { ActivityActionItem } from "../../src/features/activity/model/activity-action";
import { projectActivityActionListItem } from "../../src/features/activity/model/activity-action-list-item";
import { yieldApiActionFixture, yieldApiYieldFixture } from "../fixtures";

const makeItem = (
  actionData: ActivityActionItem["actionData"],
  yieldData: ActivityActionItem["yieldData"]
): ActivityActionItem => ({
  actionData,
  validatorsData: [],
  walletScope: {} as never,
  yieldData,
});

describe("Activity action list item projection", () => {
  it("projects domain and time values without React", () => {
    const yieldData = yieldApiYieldFixture();
    const projection = projectActivityActionListItem({
      action: makeItem(
        yieldApiActionFixture({
          createdAt: DateTime.makeUnsafe("2026-07-28T08:00:00.000Z"),
          status: "FAILED",
          type: "STAKE",
          yieldId: yieldData.id,
        }),
        yieldData
      ),
      locale: "en-US",
      presentationTime: {
        now: DateTime.makeUnsafe("2026-07-28T10:00:00.000Z"),
        timeZone: DateTime.zoneMakeNamedUnsafe("UTC"),
      },
      unknownTokenLabel: "Unknown",
    });

    expect(projection).toMatchObject({
      amountSign: "",
      canOpenDetails: true,
      direction: "deposit",
      isPositive: true,
      showFailedBadge: true,
      showUnavailableYieldDetails: false,
      timestamp: {
        dayKind: "today",
        relative: { unit: "hours", value: 2 },
      },
      title: {
        _tag: "deposited",
        tokenSymbol: yieldData.token.symbol,
      },
      tokenSymbol: yieldData.token.symbol,
    });
  });

  it("projects a generic unavailable action with its fallback token label", () => {
    const projection = projectActivityActionListItem({
      action: makeItem(
        yieldApiActionFixture({
          createdAt: undefined,
          type: "VOTE",
        }),
        null
      ),
      locale: "en-US",
      presentationTime: null,
      unknownTokenLabel: "Unknown",
    });

    expect(projection).toMatchObject({
      canOpenDetails: false,
      direction: "other",
      showUnavailableYieldDetails: true,
      timestamp: null,
      title: {
        _tag: "generic",
        actionLabel: "Vote",
        tokenSymbol: "Unknown",
      },
      tokenSymbol: "Unknown",
    });
  });

  it.each(["CANCELED", "STALE"] as const)(
    "does not offer details for a %s action",
    (status) => {
      const yieldData = yieldApiYieldFixture();
      const projection = projectActivityActionListItem({
        action: makeItem(
          yieldApiActionFixture({
            status,
            yieldId: yieldData.id,
          }),
          yieldData
        ),
        locale: "en-US",
        presentationTime: null,
        unknownTokenLabel: "Unknown",
      });

      expect(projection.canOpenDetails).toBe(false);
    }
  );
});
