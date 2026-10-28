import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
  WalletAddress,
  YieldId,
} from "../../../src/domain/identity/identifiers";
import { tokenString } from "../../../src/domain/token/token";
import type { EarnEntryState } from "../../../src/features/earn/state/earn-selection/state/owner";
import { clearEarnEntryAmounts } from "../../../src/features/earn/state/earn-selection/state/owner";
import { makeDefaultEarnIntent } from "../../../src/features/earn/state/earn-selection/types";

const owner = {
  address: Schema.decodeSync(WalletAddress)(
    "0x9999999999999999999999999999999999999999"
  ),
  network: "ethereum",
} as EarnEntryState["owner"];

const settledEntry: EarnEntryState = {
  categoryGrouping: false,
  initializationPhase: "complete",
  initParams: null,
  intent: makeDefaultEarnIntent(),
  owner,
};

describe("Earn Entry amount clearing on workflow start", () => {
  it("returns the previous state when there is nothing left to clear", () => {
    expect(clearEarnEntryAmounts(settledEntry)).toBe(settledEntry);
  });

  it("clears the entered amount but keeps what the workflow executes against", () => {
    const selection = {
      ...settledEntry.intent,
      selectedProviderOption: null,
      selectedTokenKey: tokenString({ network: "ethereum", symbol: "ETH" }),
      selectedYieldId: Schema.decodeSync(YieldId)("ethereum-eth-lido-staking"),
    };
    const touched: EarnEntryState = {
      ...settledEntry,
      intent: {
        ...selection,
        amountInput: "manual",
        stakeAmount: "12",
        useMaxAmount: true,
      },
    };

    expect(clearEarnEntryAmounts(touched)).toStrictEqual({
      ...settledEntry,
      intent: selection,
    });
  });

  it("keeps the initialization seed the selection was resolved from", () => {
    const seeded: EarnEntryState = {
      ...settledEntry,
      initParams: {
        accountId: null,
        balanceId: null,
        network: null,
        pendingaction: null,
        tab: null,
        token: null,
        validator: "validator-a",
        yieldId: Schema.decodeSync(YieldId)("seeded-yield"),
      },
      intent: {
        ...settledEntry.intent,
        requestedValidator: "validator-a",
        stakeAmount: "5",
      },
    };

    expect(clearEarnEntryAmounts(seeded)).toStrictEqual({
      ...seeded,
      intent: { ...seeded.intent, stakeAmount: "0" },
    });
  });
});
