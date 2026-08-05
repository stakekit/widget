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

  it("does not project an unavailable action without a readable token", () => {
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
    });

    expect(projection).toBeNull();
  });

  it.each([
    "",
    "  ",
    "0x",
    "0X0000000000000000000000000000000000000001",
    "0x0000000000000000000000000000000000000001",
  ])(
    "does not project an action with an unusable raw token value (%s)",
    (inputToken) => {
      const projection = projectActivityActionListItem({
        action: makeItem(
          yieldApiActionFixture({
            rawArguments: { inputToken },
            type: "VOTE",
          }),
          null
        ),
        locale: "en-US",
        presentationTime: null,
      });

      expect(projection).toBeNull();
    }
  );

  it("keeps a readable raw token for an unavailable yield", () => {
    const projection = projectActivityActionListItem({
      action: makeItem(
        yieldApiActionFixture({
          rawArguments: { inputToken: "POL" },
          type: "VOTE",
        }),
        null
      ),
      locale: "en-US",
      presentationTime: null,
    });

    expect(projection?.tokenSymbol).toBe("POL");
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
      });

      expect(projection?.canOpenDetails).toBe(false);
    }
  );
});
