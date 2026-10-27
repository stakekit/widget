import { describe, expect, it } from "vitest";
import type {
  EarnBalance,
  EarnValidator,
} from "../../../src/domain/earn/models";
import { getMaxSelectedValidators } from "../../../src/domain/earn/validator";
import { selectValidator } from "../../../src/features/earn/state/earn-selection/model/transitions";
import { makeDefaultEarnIntent } from "../../../src/features/earn/state/earn-selection/types";
import {
  makeAutomaticPendingActionModalState,
  makePendingActionModalStore,
  togglePendingActionValidator,
} from "../../../src/features/position-details/model/flow-actions";

const SUBSTRATE_LIMIT = 16;

const validators = Array.from(
  { length: SUBSTRATE_LIMIT + 1 },
  (_, index) =>
    ({
      address: `validator-${index}`,
      key: `validator-${index}`,
    }) as unknown as EarnValidator
);

describe("Validator selection limit", () => {
  it("caps Substrate nominations at 16 and leaves other networks unbounded", () => {
    expect(getMaxSelectedValidators("polkadot")).toBe(SUBSTRATE_LIMIT);
    expect(getMaxSelectedValidators("kusama")).toBe(SUBSTRATE_LIMIT);
    expect(getMaxSelectedValidators("cosmos")).toBeNull();
  });

  it("does not add a validator to an Earn selection already at the limit", () => {
    const atLimit = {
      ...makeDefaultEarnIntent(),
      selectedValidators: validators.slice(0, SUBSTRATE_LIMIT),
    };

    const next = selectValidator({
      fallbackSelection: [],
      intent: atLimit,
      maxSelected: SUBSTRATE_LIMIT,
      multiselect: true,
      validator: validators[SUBSTRATE_LIMIT]!,
    });

    expect(next.selectedValidators).toHaveLength(SUBSTRATE_LIMIT);

    const deselected = selectValidator({
      fallbackSelection: [],
      intent: atLimit,
      maxSelected: SUBSTRATE_LIMIT,
      multiselect: true,
      validator: validators[0]!,
    });
    expect(deselected.selectedValidators).toHaveLength(SUBSTRATE_LIMIT - 1);
  });

  it("does not add a pending-action validator beyond the Substrate limit", () => {
    const yieldBalance = {
      address: "owner",
      pendingActions: [],
      token: { network: "polkadot" },
      type: "active",
      validators: validators.slice(0, SUBSTRATE_LIMIT),
    } as unknown as EarnBalance;
    const store = {
      ...makePendingActionModalStore(),
      explicit: true,
      state: makeAutomaticPendingActionModalState({
        pendingAction: {
          arguments: {
            fields: [{ name: "validatorAddresses", required: true }],
          },
          intent: "manage",
          passthrough: "passthrough",
          type: "VOTE",
        } as never,
        yieldBalance,
      }),
    };

    const next = togglePendingActionValidator({
      store,
      validator: validators[SUBSTRATE_LIMIT]!.address,
    });

    expect(next.state.selectedValidators.size).toBe(SUBSTRATE_LIMIT);
  });
});
