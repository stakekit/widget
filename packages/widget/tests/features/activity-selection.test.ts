import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";
import {
  activitySelectedActionAtom,
  activitySelectedValidatorsAtom,
  activitySelectedYieldAtom,
  activitySelectionAtom,
  activityTransactionWorkflowKeyAtom,
} from "../../src/features/activity/state/selection";
import {
  yieldApiActionFixture,
  yieldApiValidatorFixture,
  yieldApiYieldFixture,
} from "../fixtures";
import { decodeValidator } from "../utils/validators";

describe("activity selection atoms", () => {
  it("initializes empty, exposes focused selections, and resets", () => {
    const registry = AtomRegistry.make();
    const action = yieldApiActionFixture();
    const selectedYield = yieldApiYieldFixture();
    const validators = [decodeValidator(yieldApiValidatorFixture())];
    const providersDetails = [
      {
        address: "validator-1",
        logo: "https://example.com/provider.png",
        name: "Provider",
        rewardRate: 4.2,
        rewardType: "apy",
        website: "https://example.com",
      },
    ];

    expect(registry.get(activitySelectedActionAtom)).toBeNull();
    expect(registry.get(activitySelectedYieldAtom)).toBeNull();
    expect(registry.get(activitySelectedValidatorsAtom)).toBeNull();
    expect(registry.get(activityTransactionWorkflowKeyAtom)).toBeNull();

    registry.set(activitySelectionAtom, {
      providersDetails,
      selectedAction: action,
      selectedValidators: validators,
      selectedYield,
    });

    expect(registry.get(activitySelectedActionAtom)).toBe(action);
    expect(registry.get(activitySelectedYieldAtom)).toBe(selectedYield);
    expect(registry.get(activitySelectedValidatorsAtom)).toBe(validators);
    expect(
      registry.get(activityTransactionWorkflowKeyAtom)?.actionMeta
        .providersDetails
    ).toEqual(providersDetails);

    registry.set(activitySelectionAtom, null);

    expect(registry.get(activitySelectedActionAtom)).toBeNull();
    expect(registry.get(activitySelectedYieldAtom)).toBeNull();
    expect(registry.get(activitySelectedValidatorsAtom)).toBeNull();
    expect(registry.get(activityTransactionWorkflowKeyAtom)).toBeNull();
  });
});
