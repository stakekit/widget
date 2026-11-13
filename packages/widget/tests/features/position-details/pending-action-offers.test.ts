import BigNumber from "bignumber.js";
import { Result, Schema } from "effect";
import { describe, expect, it } from "vitest";

import { preparePendingActionCommand } from "../../../src/domain/action/action-command";
import { EarnBalance } from "../../../src/domain/earn/balance";
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import { getPendingActionOffers } from "../../../src/features/position-details/model/pending-action-offers";
import { yieldApiYieldFixture, yieldBalanceFixture } from "../../fixtures";

const selectedYield = yieldApiYieldFixture();

const makeBalance = (overrides: Partial<typeof EarnBalance.Encoded>) =>
  Schema.decodeSync(EarnBalance)(
    yieldBalanceFixture({ token: selectedYield.token, ...overrides })
  );

const claimAll = {
  amount: null,
  arguments: null,
  intent: "manage",
  passthrough: "claim-all",
  type: "CLAIM_REWARDS",
} as const;

describe("getPendingActionOffers", () => {
  it.each([
    { order: ["active", "claimable"], source: "active" },
    { order: ["claimable", "active"], source: "claimable" },
  ] as const)(
    "offers an action $order share once, from the balance listing it first",
    ({ order, source }) => {
      const balances = {
        active: makeBalance({
          amount: "1.5",
          pendingActions: [claimAll],
          type: "active",
        }),
        claimable: makeBalance({
          amount: "0.000001",
          pendingActions: [claimAll],
          type: "claimable",
        }),
      };

      const offers = getPendingActionOffers({
        balances: order.map((type) => balances[type]),
        enteredAmounts: new Map(),
      });

      expect(
        offers.map((offer) => ({
          amount: offer.amount,
          balanceType: offer.yieldBalance.type,
          passthrough: offer.pendingAction.passthrough,
        }))
      ).toEqual([
        { amount: null, balanceType: source, passthrough: "claim-all" },
      ]);
    }
  );

  // Two locked balances of one token: two Campaigns' unpaid rewards. An
  // entered 3 is above what the first holds when that is 1, not when 5.
  it.each([
    { order: ["1", "5"], amount: "1", enteredValidation: "AboveMaximum" },
    { order: ["5", "1"], amount: "5", enteredValidation: null },
  ] as const)(
    "projects a withdrawal locked balances $order share from the first",
    ({ order, amount, enteredValidation }) => {
      const withdraw = {
        amount: null,
        arguments: {
          fields: [
            { label: "Amount", name: "amount", required: true, type: "string" },
          ],
        },
        intent: "manage",
        passthrough: "withdraw-locked",
        type: "WITHDRAW",
      } as const;
      const campaigns = {
        "1": "campaign-one",
        "5": "campaign-five",
      } as const;

      const balances = order.map((locked) =>
        makeBalance({
          amount: locked,
          campaignId: campaigns[locked],
          pendingActions: [withdraw],
          type: "locked",
        })
      );

      const offers = getPendingActionOffers({
        balances,
        enteredAmounts: new Map(),
      });

      expect(
        offers.map((offer) => ({
          amount: offer.amount?.toFixed(),
          campaignId: offer.yieldBalance.campaignId,
          validation: offer.validation,
        }))
      ).toEqual([{ amount, campaignId: campaigns[amount], validation: null }]);
      expect(
        getPendingActionOffers({
          balances,
          enteredAmounts: new Map([[offers[0]!.key, new BigNumber("3")]]),
        }).map((offer) => [offer.amount?.toFixed(), offer.validation])
      ).toEqual([["3", enteredValidation]]);
    }
  );

  const amountArguments = {
    fields: [
      { label: "Amount", name: "amount", required: true, type: "string" },
    ],
  } as const;
  const kmno = {
    ...selectedYield.token,
    address: "0x0000000000000000000000000000000000000008",
    symbol: "KMNO",
  };
  const claimOf = (passthrough: string) =>
    ({
      amount: null,
      arguments: amountArguments,
      intent: "manage",
      passthrough,
      type: "CLAIM_REWARDS",
    }) as const;

  it("keeps each token's rewards in its own offer, its entered amount its own", () => {
    const balances = [
      makeBalance({
        amount: "10",
        pendingActions: [claimOf("claim-kmno")],
        token: kmno,
        type: "claimable",
      }),
      makeBalance({
        amount: "3",
        pendingActions: [claimOf("claim-base")],
        type: "claimable",
      }),
    ];
    const [kmnoOffer] = getPendingActionOffers({
      balances,
      enteredAmounts: new Map(),
    });
    if (!kmnoOffer) throw new Error("Expected the KMNO offer");
    const enteredAmounts = new Map([[kmnoOffer.key, new BigNumber("4")]]);

    const offers = getPendingActionOffers({ balances, enteredAmounts });

    expect(
      offers.map((offer) => [
        offer.yieldBalance.token.symbol,
        offer.amount?.toFixed(),
      ])
    ).toEqual([
      ["KMNO", "4"],
      [selectedYield.token.symbol, "3"],
    ]);
    const prepared = preparePendingActionCommand({
      additionalAddresses: null,
      address: Schema.decodeSync(WalletAddress)("0xWallet"),
      integration: selectedYield,
      pendingAction: offers[0]!.pendingAction,
      pendingActionsState: enteredAmounts,
      selectedValidators: [],
      yieldBalance: offers[0]!.yieldBalance,
    });
    expect(Result.getOrThrow(prepared).command).toMatchObject({
      arguments: { amount: "4" },
      passthrough: "claim-kmno",
    });
  });

  it("offers a claim balances of two tokens share once, in the first's token", () => {
    const offers = getPendingActionOffers({
      balances: [
        makeBalance({
          amount: "10",
          pendingActions: [claimOf("claim-all")],
          token: kmno,
          type: "claimable",
        }),
        makeBalance({
          amount: "3",
          pendingActions: [claimOf("claim-all")],
          type: "claimable",
        }),
      ],
      enteredAmounts: new Map(),
    });

    expect(
      offers.map((offer) => [
        offer.yieldBalance.token.symbol,
        offer.amount?.toFixed(),
      ])
    ).toEqual([["KMNO", "10"]]);
  });

  it("offers each dated withdrawable balance's withdrawal with its own amount", () => {
    const withdrawable = (amount: string, date: string, passthrough: string) =>
      makeBalance({
        amount,
        date,
        pendingActions: [
          {
            amount: null,
            arguments: amountArguments,
            intent: "manage",
            passthrough,
            type: "WITHDRAW",
          },
        ],
        type: "withdrawable",
      });

    const offers = getPendingActionOffers({
      balances: [
        withdrawable("2", "2026-12-01T00:00:00.000Z", "withdraw-december"),
        withdrawable("7", "2027-01-01T00:00:00.000Z", "withdraw-january"),
        withdrawable("9", "2027-02-01T00:00:00.000Z", "withdraw-january"),
      ],
      enteredAmounts: new Map(),
    });

    expect(
      offers.map((offer) => [
        offer.pendingAction.passthrough,
        offer.amount?.toFixed(),
      ])
    ).toEqual([
      ["withdraw-december", "2"],
      ["withdraw-january", "7"],
    ]);
  });
});
