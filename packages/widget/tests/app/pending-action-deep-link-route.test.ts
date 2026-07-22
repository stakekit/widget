import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { canClaimPendingActionDeepLink } from "../../src/app/routes/state/pending-action-deep-link-route";
import { WalletAddress, YieldId } from "../../src/domain/schema/identifiers";
import { PendingActionDeepLinkIntentId } from "../../src/features/earn/pending-action-deep-link";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const otherAddress = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000002"
);
const yieldId = Schema.decodeSync(YieldId)("test-yield");

const intent = (owner = address) =>
  new PendingActionDeepLinkIntentId({
    address: owner,
    network: "ethereum",
    pendingAction: "CLAIM_REWARDS",
    validator: null,
    yieldId,
  });

describe("pending-action deep-link route claims", () => {
  it("claims the rendered wallet-owner intent once", () => {
    const currentIntent = intent();

    expect(
      canClaimPendingActionDeepLink({
        claimedIntents: [],
        currentIntent,
        requestedIntent: intent(),
      })
    ).toBe(true);
    expect(
      canClaimPendingActionDeepLink({
        claimedIntents: [currentIntent],
        currentIntent,
        requestedIntent: intent(),
      })
    ).toBe(false);
  });

  it("rejects a stale rendered intent after the wallet owner changes", () => {
    expect(
      canClaimPendingActionDeepLink({
        claimedIntents: [],
        currentIntent: intent(otherAddress),
        requestedIntent: intent(),
      })
    ).toBe(false);
  });

  it("does not reclaim an earlier intent after another intent", () => {
    const first = intent();
    const second = intent(otherAddress);

    expect(
      canClaimPendingActionDeepLink({
        claimedIntents: [first, second],
        currentIntent: first,
        requestedIntent: first,
      })
    ).toBe(false);
  });
});
