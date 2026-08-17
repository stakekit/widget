import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import type { EarnEntryState } from "../../src/features/earn/state/earn-selection/state/owner";
import { resetEarnEntryIntent } from "../../src/features/earn/state/earn-selection/state/owner";
import { makeDefaultEarnIntent } from "../../src/features/earn/state/earn-selection/types";

const owner = {
  address: Schema.decodeSync(WalletAddress)(
    "0x9999999999999999999999999999999999999999"
  ),
  network: "ethereum",
} as EarnEntryState["owner"];

const settledEntry: EarnEntryState = {
  dashboardVariant: false,
  initializationPhase: "complete",
  initParams: null,
  intent: makeDefaultEarnIntent(),
  owner,
};

describe("Earn Entry reset", () => {
  it("returns the previous state when there is nothing left to reset", () => {
    expect(resetEarnEntryIntent(settledEntry)).toBe(settledEntry);
  });

  it("clears a touched intent", () => {
    const touched: EarnEntryState = {
      ...settledEntry,
      intent: { ...settledEntry.intent, stakeAmount: "12", useMaxAmount: true },
    };

    expect(resetEarnEntryIntent(touched)).toStrictEqual(settledEntry);
  });

  it("completes an entry that is still applying its initialization seed", () => {
    const initializing: EarnEntryState = {
      ...settledEntry,
      initializationPhase: "applying-init-params",
    };

    expect(resetEarnEntryIntent(initializing)).toStrictEqual(settledEntry);
  });
});
