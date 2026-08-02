import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { EarnBalance } from "../../src/domain/schema/earn-models";
import {
  makeAutomaticPendingActionModalState,
  makePendingActionModalStore,
  openPendingActionModal,
  reconcilePendingActionModalReceipt,
} from "../../src/features/position-details/model/classic-flow-actions";
import {
  yieldApiValidatorFixture,
  yieldApiYieldFixture,
  yieldBalanceFixture,
} from "../fixtures";

const selectedYield = yieldApiYieldFixture();
const balance = Schema.decodeUnknownSync(EarnBalance)(
  yieldBalanceFixture({
    pendingActions: [
      {
        amount: "1",
        intent: "manage",
        passthrough: "claim-rewards",
        type: "CLAIM_REWARDS",
      },
    ],
    token: selectedYield.token,
    validators: [yieldApiValidatorFixture({ address: "validator-a" })],
  })
);
const pendingActionDto = balance.pendingActions[0]!;

describe("Position Details action model", () => {
  it("closes only the pending-action attempt acknowledged by Started", () => {
    const first = openPendingActionModal({
      input: { pendingActionDto, yieldBalance: balance },
      store: makePendingActionModalStore(),
    });
    if (first.state._tag !== "Open") {
      throw new Error("Expected an open first attempt");
    }

    const closed = reconcilePendingActionModalReceipt({
      receipt: { _tag: "Started", attemptId: first.state.attemptId },
      store: first,
    });
    expect(closed.state._tag).toBe("Closed");

    const reopened = openPendingActionModal({
      input: { pendingActionDto, yieldBalance: balance },
      store: closed,
    });
    expect(reopened.state._tag).toBe("Open");
    expect(
      reconcilePendingActionModalReceipt({
        receipt: { _tag: "Started", attemptId: first.state.attemptId },
        store: reopened,
      }).state._tag
    ).toBe("Open");
  });

  it("does not apply an automatic receipt to a different pending action", () => {
    const first = makeAutomaticPendingActionModalState({
      pendingActionDto,
      yieldBalance: balance,
    });
    const nextPendingAction = {
      ...pendingActionDto,
      passthrough: "different-pending-action",
    };
    const second = makeAutomaticPendingActionModalState({
      pendingActionDto: nextPendingAction,
      yieldBalance: balance,
    });
    if (first._tag !== "Open") {
      throw new Error("Expected an open first automatic attempt");
    }

    expect(
      reconcilePendingActionModalReceipt({
        receipt: { _tag: "Started", attemptId: first.attemptId },
        store: { ...makePendingActionModalStore(), state: second },
      }).state._tag
    ).toBe("Open");
  });
});
