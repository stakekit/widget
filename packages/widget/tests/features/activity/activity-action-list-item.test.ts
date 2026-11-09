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
  yieldApiTransactionFixture,
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
      time: { unit: "hours", value: 2 },
      title: {
        _tag: "deposited",
        tokenSymbol: yieldData.token.symbol,
      },
      token: { symbol: yieldData.token.symbol },
      amountTokenSymbol: yieldData.token.symbol,
      voided: true,
    });
  });

  it.each([
    ["2026-07-27T10:00:01.000Z", { unit: "hours", value: 23 }],
    ["2026-07-27T10:00:00.000Z", { unit: "clock", label: "12:00 PM" }],
    ["2025-12-31T23:30:00.000Z", { unit: "clock", label: "12:30 AM" }],
  ] as const)(
    "shows how long ago within a day, then the time of day in the presentation zone (%s)",
    (createdAt, time) => {
      const projection = projectActivityActionListItem({
        action: makeItem(
          yieldApiActionFixture({
            createdAt: DateTime.makeUnsafe(createdAt),
            type: "STAKE",
          }),
          null
        ),
        locale: "en-US",
        presentationTime: {
          now: DateTime.makeUnsafe("2026-07-28T10:00:00.000Z"),
          timeZone: DateTime.zoneMakeNamedUnsafe("Europe/Paris"),
        },
      });

      expect(projection.time).toEqual(time);
    }
  );

  it.each([
    // Sent an hour after it was created: it ended then.
    [
      "an hour after it was created",
      { broadcastedAt: "2026-07-20T09:00:00.000Z", completedAt: null },
      { unit: "clock", label: "11:00 AM" },
    ],
    // Completed on the next day: the time names its day, which its row's
    // header does not.
    [
      "on the next day",
      { broadcastedAt: null, completedAt: "2026-07-21T08:30:00.000Z" },
      { unit: "clock", label: "Jul 21, 10:30 AM" },
    ],
    [
      "with no later time recorded",
      { broadcastedAt: null, completedAt: null },
      { unit: "clock", label: "10:00 AM" },
    ],
  ] as const)(
    "dates a failed action by when it ended, %s",
    (_case, { broadcastedAt, completedAt }, time) => {
      const projection = projectActivityActionListItem({
        action: makeItem(
          yieldApiActionFixture({
            completedAt: completedAt ? DateTime.makeUnsafe(completedAt) : null,
            createdAt: DateTime.makeUnsafe("2026-07-20T08:00:00.000Z"),
            status: "FAILED",
            transactions: [
              yieldApiTransactionFixture({
                broadcastedAt: broadcastedAt
                  ? DateTime.makeUnsafe(broadcastedAt)
                  : null,
                status: "FAILED",
              }),
            ],
            type: "STAKE",
          }),
          null
        ),
        locale: "en-US",
        presentationTime: {
          now: DateTime.makeUnsafe("2026-07-28T10:00:00.000Z"),
          timeZone: DateTime.zoneMakeNamedUnsafe("Europe/Paris"),
        },
      });

      expect(projection).toMatchObject({ time, voided: true });
    }
  );

  it.each([
    ["SUCCESS", false],
    ["FAILED", true],
    ["CANCELED", true],
    ["PROCESSING", false],
  ] as const)("voids a %s action's amount: %s", (status, voided) => {
    const projection = projectActivityActionListItem({
      action: makeItem(yieldApiActionFixture({ status, type: "STAKE" }), null),
      locale: "en-US",
      presentationTime: null,
    });

    expect(projection.voided).toBe(voided);
  });

  it("values an action whose token is unknown in USD instead", () => {
    const projection = projectActivityActionListItem({
      action: makeItem(
        yieldApiActionFixture({
          amount: "0.1",
          amountUsd: "0.13921006537367514",
          type: "STAKE",
        }),
        null
      ),
      locale: "en-US",
      presentationTime: null,
    });

    expect(projection).toMatchObject({
      amountFiat: "$0.14",
      amountTokenSymbol: null,
      title: { _tag: "deposited", tokenSymbol: null },
    });
  });

  it("keeps the withdrawal sign on the USD it falls back to", () => {
    const projection = projectActivityActionListItem({
      action: makeItem(
        yieldApiActionFixture({
          amount: "0.1",
          amountUsd: "0.13921006537367514",
          type: "UNSTAKE",
        }),
        null
      ),
      locale: "en-US",
      presentationTime: null,
    });

    expect(projection.amountText).toBe("\u2212$0.14");
  });

  it("shows a token amount with its symbol, signed", () => {
    const projection = projectActivityActionListItem({
      action: makeItem(
        yieldApiActionFixture({ amount: "1", type: "UNSTAKE" }),
        yieldApiYieldFixture()
      ),
      locale: "en-US",
      presentationTime: null,
    });

    expect(projection.amountText).toBe(
      `\u22121 ${yieldApiYieldFixture().token.symbol}`
    );
  });

  it("sentence-cases a generic action's title", () => {
    const projection = projectActivityActionListItem({
      action: makeItem(
        yieldApiActionFixture({ type: "VOTE_LOCKED" }),
        yieldApiYieldFixture()
      ),
      locale: "en-US",
      presentationTime: null,
    });

    expect(projection.title).toMatchObject({
      _tag: "generic",
      actionLabel: "Vote locked",
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
      token: null,
      amountTokenSymbol: null,
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

      expect(projection.amountTokenSymbol).toBeNull();
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

    expect(projection.amountTokenSymbol).toBe("POL");
  });

  it.each([
    ["SUCCESS", "completed"],
    ["FAILED", "failed"],
    ["WAITING_FOR_NEXT", "in_progress"],
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

  it.each([
    ["STAKE", "deposit", "deposited"],
    ["UNSTAKE", "withdraw", "withdrew"],
  ] as const)(
    "titles a waiting %s by what it does, a finished one by what it did",
    (type, waitingTag, doneTag) => {
      const yieldData = yieldApiYieldFixture();
      const project = (status: "SUCCESS" | "WAITING_FOR_NEXT") =>
        projectActivityActionListItem({
          action: makeItem(
            yieldApiActionFixture({ status, type, yieldId: yieldData.id }),
            yieldData
          ),
          locale: "en-US",
          presentationTime: null,
        });

      expect(project("WAITING_FOR_NEXT").title).toEqual({
        _tag: waitingTag,
        tokenSymbol: yieldData.token.symbol,
      });
      expect(project("SUCCESS").title).toEqual({
        _tag: doneTag,
        tokenSymbol: yieldData.token.symbol,
      });
    }
  );

  it("calls out a waiting action until its continuation window closes", () => {
    const yieldData = yieldApiYieldFixture();
    const project = (now: string) =>
      projectActivityActionListItem({
        action: makeItem(
          yieldApiActionFixture({
            createdAt: DateTime.makeUnsafe("2026-08-20T10:00:00.000Z"),
            status: "WAITING_FOR_NEXT",
            yieldId: yieldData.id,
          }),
          yieldData
        ),
        locale: "en-US",
        presentationTime: {
          now: DateTime.makeUnsafe(now),
          timeZone: DateTime.zoneMakeNamedUnsafe("UTC"),
        },
      }).statusLabel;

    expect(project("2026-08-20T10:12:00.000Z")).toBe("in_progress");
    expect(project("2026-08-27T10:00:00.000Z")).toBe("expired");
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
        amountSign: "\u2212",
        direction: "withdraw",
        isPositive: false,
      });
    }
  );

  it.each([
    [
      "the confidential asset",
      { inputToken: confidentialFixture.cUsdc.address },
      "cUSDC",
    ],
    [
      "the underlying",
      { inputToken: confidentialFixture.usdc.address },
      "USDC",
    ],
    ["no input token", null, "USDC"],
  ] as const)(
    "titles a confidential deposit of %s with its input token and awaits its batch",
    (_name, rawArguments, symbol) => {
      const projection = projectActivityActionListItem({
        action: makeItem(
          yieldApiActionFixture({
            amount: "1",
            rawArguments,
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
        title: { _tag: "deposit_submitted", tokenSymbol: symbol },
        amountTokenSymbol: symbol,
      });
    }
  );

  it.each([
    [
      "to the confidential asset",
      { outputToken: confidentialFixture.cUsdc.address },
      "cUSDC",
    ],
    ["without an output token", null, "csteakcUSDC"],
  ] as const)(
    "titles a private confidential withdrawal %s with its receive token and counts it in the vault share",
    (_, rawArguments, titleSymbol) => {
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
        title: {
          _tag: "private_withdrawal_requested",
          tokenSymbol: titleSymbol,
        },
        amountTokenSymbol: "csteakcUSDC",
      });
    }
  );

  it.each([
    ["STAKE", "DEPOSIT_SETTLED", "completed", "deposited"],
    ["STAKE", "DEPOSIT_CANCELLED", "canceled", "deposit_canceled"],
    ["UNSTAKE", "REDEMPTION_SETTLED", "completed", "withdrew"],
    [
      "UNSTAKE",
      "REDEMPTION_CANCELLED",
      "canceled",
      "private_withdrawal_canceled",
    ],
  ] as const)(
    "presents a confidential %s whose batch event is %s as %s",
    (type, eventType, statusLabel, titleTag) => {
      const projection = projectActivityActionListItem({
        action: makeItem(
          yieldApiActionFixture({
            amount: "1",
            events: [
              {
                id: "event",
                occurredAt: "2026-08-27T08:00:00.000Z",
                transactionHash: null,
                type: eventType,
              },
            ],
            rawArguments:
              type === "STAKE"
                ? { inputToken: confidentialFixture.cUsdc.address }
                : { outputToken: confidentialFixture.cUsdc.address },
            status: "SUCCESS",
            type,
          }),
          confidentialYieldFixture()
        ),
        locale: "en-US",
        presentationTime: null,
      });

      expect(projection).toMatchObject({
        statusLabel,
        title: { _tag: titleTag, tokenSymbol: "cUSDC" },
      });
    }
  );

  it("titles an instant confidential withdrawal with the underlying it paid out and counts it in the vault share", () => {
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
      amountTokenSymbol: "csteakcUSDC",
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
      amountTokenSymbol: "USDC",
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

  it("titles a withdrawal with the receive token it names and counts it in the Value Token", () => {
    const usds = {
      address: "0x00000000000000000000000000000000000000d5",
      decimals: 18,
      name: "USDS",
      network: "ethereum",
      symbol: "USDS",
    } as const;
    const dai = {
      ...usds,
      address: "0x00000000000000000000000000000000000000da",
      name: "Dai",
      symbol: "DAI",
    };
    const yieldData = yieldApiYieldFixture({ token: dai, tokens: [dai, usds] });
    const projection = projectActivityActionListItem({
      action: makeItem(
        yieldApiActionFixture({
          amount: "1",
          rawArguments: { outputToken: usds.address },
          status: "SUCCESS",
          type: "UNSTAKE",
        }),
        yieldData
      ),
      locale: "en-US",
      presentationTime: null,
    });

    expect(projection).toMatchObject({
      title: { _tag: "withdrew", tokenSymbol: "USDS" },
      amountTokenSymbol: "DAI",
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
      time: { unit: "hours", value: 2 },
      title: { _tag: "borrow", action: "supply", tokenSymbol: "USDC" },
      token: { network: "ethereum", symbol: "USDC" },
      amountTokenSymbol: "USDC",
      voided: false,
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

    expect(projection).toMatchObject({
      amount: "1.5",
      amountFiat: null,
      amountTokenSymbol: "USDC",
    });
  });

  it("shows no amount for a Borrow action whose token is unknown", () => {
    // Borrow actions carry no USD value, and a number without its unit is no
    // amount, so the row shows none.
    const projection = projectActivityActionListItem({
      action: {
        ...makeBorrowItem({
          action: "withdraw",
          amount: "1.5",
          status: "SUCCESS",
        }),
        token: null,
      },
      locale: "en-US",
      presentationTime: null,
    });

    expect(projection).toMatchObject({
      amount: "1.5",
      amountFiat: null,
      amountText: null,
      amountTokenSymbol: null,
    });
  });

  it.each([
    ["borrow", "FAILED", "neutral", "failed", false],
    ["repay", "PROCESSING", "neutral", "processing", true],
    ["supply", "WAITING_FOR_NEXT", "deposit", "in_progress", true],
    ["withdraw", "SUCCESS", "withdraw", "completed", false],
    ["disableCollateral", "CANCELED", "neutral", "canceled", false],
  ] as const)(
    "projects a Borrow %s action as %s",
    (action, status, direction, statusLabel, inProgress) => {
      const projection = projectActivityActionListItem({
        action: makeBorrowItem({ action, status }),
        locale: "en-US",
        presentationTime: null,
      });

      expect(projection).toMatchObject({
        amount: null,
        direction,
        statusLabel,
        title: { _tag: "borrow", action, inProgress },
      });
    }
  );
});
