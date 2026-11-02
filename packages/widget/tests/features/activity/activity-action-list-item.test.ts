import { DateTime, Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
  getActivityActionCapabilities,
  isActivityActionOwnedByScope,
  isContinuableYieldAction,
} from "../../../src/domain/activity/action-capabilities";
import { BorrowActivityAction } from "../../../src/domain/borrow/responses";
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import { WalletScopeOwnerKey } from "../../../src/domain/wallet/wallet-scope";
import type {
  BorrowActivityItem,
  YieldActivityItem,
} from "../../../src/features/activity/model/activity-action";
import { projectActivityActionListItem } from "../../../src/features/activity/model/activity-action-list-item";
import {
  confidentialFixture,
  confidentialYieldFixture,
  yieldApiActionFixture,
  yieldApiYieldFixture,
} from "../../fixtures";

const makeItem = (
  actionData: YieldActivityItem["actionData"],
  yieldData: YieldActivityItem["yieldData"]
): YieldActivityItem => ({
  _tag: "yield",
  actionData,
  validatorsData: [],
  walletScope: {} as never,
  yieldData,
});

const makeBorrowItem = ({
  action,
  amount,
  amountRaw,
  status,
}: {
  readonly action: BorrowActivityItem["actionData"]["action"];
  readonly amount?: string;
  readonly amountRaw?: string;
  readonly status: BorrowActivityItem["actionData"]["status"];
}): BorrowActivityItem => ({
  _tag: "borrow",
  actionData: Schema.decodeSync(BorrowActivityAction)({
    action,
    address: "0x0000000000000000000000000000000000000001",
    createdAt: "2026-07-28T08:00:00.000Z",
    id: "borrow-action",
    integrationId: "aave-borrow",
    rawArguments: {
      ...(amount === undefined ? {} : { amount }),
      ...(amountRaw === undefined ? {} : { amountRaw }),
      marketId: "aave-ethereum-usdc",
    },
    status,
    transactions: [],
  }),
  integration: null,
  market: null,
  network: "ethereum",
  token: { decimals: 6, symbol: "USDC" } as BorrowActivityItem["token"],
  walletScope: {} as never,
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

  it("formats the date and time in the presentation time zone", () => {
    const projection = projectActivityActionListItem({
      action: makeItem(
        yieldApiActionFixture({
          createdAt: DateTime.makeUnsafe("2026-07-28T12:00:00.000Z"),
        }),
        null
      ),
      locale: "en-US",
      presentationTime: {
        now: DateTime.makeUnsafe("2026-07-28T13:00:00.000Z"),
        timeZone: DateTime.zoneMakeNamedUnsafe("Pacific/Kiritimati"),
      },
    });

    expect(projection.timestamp).toMatchObject({
      date: "Jul 29, 2026",
      dayKind: "today",
      time: "02:00",
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
      action: makeItem(yieldApiActionFixture({ type: "VOTE" }), null),
      locale: "en-US",
      presentationTime: null,
    });

    expect(projection).toMatchObject({
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

  it.each([
    ["SUCCESS", "completed"],
    ["FAILED", "failed"],
    ["WAITING_FOR_NEXT", null],
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

  it("titles a confidential deposit with the confidential asset and awaits its batch", () => {
    const projection = projectActivityActionListItem({
      action: makeItem(
        yieldApiActionFixture({
          amount: "1",
          rawArguments: { inputToken: confidentialFixture.cUsdc.address },
          status: "SUCCESS",
          type: "STAKE",
        }),
        confidentialYieldFixture()
      ),
      locale: "en-US",
      presentationTime: null,
    });

    expect(projection).toMatchObject({
      statusLabel: "awaiting_settlement",
      title: { _tag: "deposit_submitted", tokenSymbol: "cUSDC" },
      tokenSymbol: "cUSDC",
    });
  });

  it.each([
    [
      "to the confidential asset",
      { outputToken: confidentialFixture.cUsdc.address },
    ],
    ["without an output token", null],
  ] as const)(
    "titles a private confidential withdrawal %s as requested and awaiting its batch",
    (_, rawArguments) => {
      const projection = projectActivityActionListItem({
        action: makeItem(
          yieldApiActionFixture({
            amount: "1",
            rawArguments,
            status: "SUCCESS",
            type: "UNSTAKE",
          }),
          confidentialYieldFixture()
        ),
        locale: "en-US",
        presentationTime: null,
      });

      expect(projection).toMatchObject({
        direction: "withdraw",
        statusLabel: "awaiting_settlement",
        title: { _tag: "private_withdrawal_requested", tokenSymbol: "cUSDC" },
        tokenSymbol: "cUSDC",
      });
    }
  );

  it("titles an instant confidential withdrawal with the underlying it paid out", () => {
    const projection = projectActivityActionListItem({
      action: makeItem(
        yieldApiActionFixture({
          amount: "1",
          rawArguments: { outputToken: confidentialFixture.usdc.address },
          status: "SUCCESS",
          type: "UNSTAKE",
        }),
        confidentialYieldFixture()
      ),
      locale: "en-US",
      presentationTime: null,
    });

    expect(projection).toMatchObject({
      statusLabel: "completed",
      title: { _tag: "withdrew", tokenSymbol: "USDC" },
      tokenSymbol: "USDC",
    });
  });

  it("titles the WITHDRAW that pays out an instant confidential withdrawal", () => {
    const projection = projectActivityActionListItem({
      action: makeItem(
        yieldApiActionFixture({
          intent: "manage",
          status: "SUCCESS",
          type: "WITHDRAW",
        }),
        confidentialYieldFixture()
      ),
      locale: "en-US",
      presentationTime: null,
    });

    expect(projection).toMatchObject({
      statusLabel: "completed",
      title: { _tag: "instant_withdrawal_finalized", tokenSymbol: "USDC" },
      tokenSymbol: "USDC",
    });
  });

  it("keeps a non-confidential withdrawal on the yield token, whatever it names", () => {
    const yieldData = yieldApiYieldFixture();
    const projection = projectActivityActionListItem({
      action: makeItem(
        yieldApiActionFixture({
          amount: "1",
          rawArguments: {
            outputToken: "0x0000000000000000000000000000000000000001",
          },
          status: "SUCCESS",
          type: "UNSTAKE",
        }),
        yieldData
      ),
      locale: "en-US",
      presentationTime: null,
    });

    expect(projection).toMatchObject({
      statusLabel: "completed",
      title: { _tag: "withdrew", tokenSymbol: yieldData.token.symbol },
    });
  });

  it.each([
    "VOTE",
    "REVOKE",
    "VOTE_LOCKED",
    "REVOTE",
    "MIGRATE",
    "MERGE",
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

  it("projects a Borrow action with its title, amount and status", () => {
    const projection = projectActivityActionListItem({
      action: makeBorrowItem({
        action: "supply",
        amount: "1.5",
        status: "SUCCESS",
      }),
      locale: "en-US",
      presentationTime: {
        now: DateTime.makeUnsafe("2026-07-28T10:00:00.000Z"),
        timeZone: DateTime.zoneMakeNamedUnsafe("UTC"),
      },
    });

    expect(projection).toMatchObject({
      amount: "1.5",
      amountSign: "+",
      statusLabel: "completed",
      timestamp: { dayKind: "today", relative: { unit: "hours", value: 2 } },
      title: { _tag: "borrow", action: "supply", tokenSymbol: "USDC" },
      tokenSymbol: "USDC",
    });
  });

  it("projects a Borrow amount given only in base units with the token decimals", () => {
    const projection = projectActivityActionListItem({
      action: makeBorrowItem({
        action: "borrow",
        amountRaw: "1500000",
        status: "SUCCESS",
      }),
      locale: "en-US",
      presentationTime: null,
    });

    expect(projection).toMatchObject({ amount: "1.5", tokenSymbol: "USDC" });
  });

  it.each([
    ["borrow", "FAILED", "neutral", "failed"],
    ["repay", "PROCESSING", "neutral", "processing"],
    ["withdraw", "SUCCESS", "withdraw", "completed"],
    ["disableCollateral", "CANCELED", "neutral", "canceled"],
  ] as const)(
    "projects a Borrow %s action as %s",
    (action, status, direction, statusLabel) => {
      const projection = projectActivityActionListItem({
        action: makeBorrowItem({ action, status }),
        locale: "en-US",
        presentationTime: null,
      });

      expect(projection).toMatchObject({
        amount: null,
        direction,
        statusLabel,
        title: { _tag: "borrow", action },
      });
    }
  );
});
