import { DateTime, Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
  getActivityActionCapabilities,
  isActivityActionOwnedByScope,
  isContinuableYieldAction,
} from "../../src/domain/activity/action-capabilities";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import { WalletScopeOwnerKey } from "../../src/domain/wallet/wallet-scope";
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
  it.each([
    ["SUCCESS", true],
    ["FAILED", true],
    ["WAITING_FOR_NEXT", true],
    ["CREATED", false],
    ["PROCESSING", false],
    ["CANCELED", false],
    ["STALE", false],
  ] as const)(
    "projects the %s Activity capabilities",
    (status, visibleInFeed) => {
      expect(getActivityActionCapabilities(status)).toEqual({
        visibleInFeed,
      });
    }
  );

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

  it("allows continuation before, but not at, the 168 hour cutoff", () => {
    const action = yieldApiActionFixture({
      createdAt: DateTime.makeUnsafe("2026-08-20T10:00:00.000Z"),
      status: "WAITING_FOR_NEXT",
    });

    expect(
      isContinuableYieldAction(
        action,
        DateTime.makeUnsafe("2026-08-27T09:59:59.999Z")
      )
    ).toBe(true);
    expect(
      isContinuableYieldAction(
        action,
        DateTime.makeUnsafe("2026-08-27T10:00:00.000Z")
      )
    ).toBe(false);
  });

  it("rejects a same-address action when its Yield belongs to another network", () => {
    const action = yieldApiActionFixture();
    const scope = new WalletScopeOwnerKey({
      address: action.address,
      network: "ethereum",
    });

    expect(
      isActivityActionOwnedByScope({
        action,
        scope,
        yieldData: yieldApiYieldFixture({ network: "polygon" }),
      })
    ).toBe(false);
    expect(
      isActivityActionOwnedByScope({ action, scope, yieldData: null })
    ).toBe(true);
  });

  it("matches EVM action owners case-insensitively", () => {
    const action = yieldApiActionFixture({
      address: Schema.decodeSync(WalletAddress)(
        "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"
      ),
    });
    const scope = new WalletScopeOwnerKey({
      address: Schema.decodeSync(WalletAddress)(
        "0xAbCdEfAbCdEfAbCdEfAbCdEfAbCdEfAbCdEfAbCd"
      ),
      network: "ethereum",
    });

    expect(
      isActivityActionOwnedByScope({ action, scope, yieldData: null })
    ).toBe(true);
  });

  it("projects an unavailable action without inventing a token", () => {
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

    expect(projection).toMatchObject({
      canOpenDetails: true,
      title: {
        _tag: "generic",
        actionLabel: "Vote",
        tokenSymbol: null,
      },
      tokenSymbol: null,
    });
  });

  it.each([
    "",
    "  ",
    "0x",
    "0X0000000000000000000000000000000000000001",
    "0x0000000000000000000000000000000000000001",
  ])(
    "projects an action while omitting an unusable raw token value (%s)",
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

      expect(projection.tokenSymbol).toBeNull();
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

    expect(projection.tokenSymbol).toBe("POL");
  });

  it.each(["CANCELED", "STALE"] as const)(
    "allows direct details for a %s action",
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

      expect(projection.canOpenDetails).toBe(true);
    }
  );

  it.each([
    ["SUCCESS", "completed"],
    ["FAILED", "failed"],
    ["WAITING_FOR_NEXT", "action-required"],
  ] as const)("projects the %s status label", (status, statusLabel) => {
    const yieldData = yieldApiYieldFixture();
    const projection = projectActivityActionListItem({
      action: makeItem(
        yieldApiActionFixture({ status, yieldId: yieldData.id }),
        yieldData
      ),
      locale: "en-US",
      presentationTime: null,
    });

    expect(projection.statusLabel).toBe(statusLabel);
  });

  it.each(["WITHDRAW_REQUEST", "INSTANT_WITHDRAW"] as const)(
    "projects %s as an outbound withdrawal",
    (type) => {
      const projection = projectActivityActionListItem({
        action: makeItem(
          yieldApiActionFixture({ amount: "1", type }),
          yieldApiYieldFixture()
        ),
        locale: "en-US",
        presentationTime: null,
      });

      expect(projection).toMatchObject({
        amountSign: "-",
        direction: "withdraw",
        isPositive: false,
      });
    }
  );

  it.each([
    "VOTE",
    "REVOKE",
    "VOTE_LOCKED",
    "REVOTE",
    "MIGRATE",
    "VERIFY_WITHDRAW_CREDENTIALS",
    "DELEGATE",
  ] as const)("projects %s as neutral", (type) => {
    const projection = projectActivityActionListItem({
      action: makeItem(yieldApiActionFixture({ type }), yieldApiYieldFixture()),
      locale: "en-US",
      presentationTime: null,
    });

    expect(projection).toMatchObject({
      amountSign: "",
      direction: "neutral",
      isPositive: false,
    });
  });
});
