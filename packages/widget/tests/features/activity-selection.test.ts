import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";
import {
  activitySelectedActionAtom,
  activitySelectedValidatorsAtom,
  activitySelectedYieldAtom,
  activitySelectionAtom,
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

    expect(registry.get(activitySelectedActionAtom)).toBeNull();
    expect(registry.get(activitySelectedYieldAtom)).toBeNull();
    expect(registry.get(activitySelectedValidatorsAtom)).toBeNull();

    registry.set(activitySelectionAtom, {
      selectedAction: action,
      selectedValidators: validators,
      selectedYield,
    });

    expect(registry.get(activitySelectedActionAtom)).toBe(action);
    expect(registry.get(activitySelectedYieldAtom)).toBe(selectedYield);
    expect(registry.get(activitySelectedValidatorsAtom)).toBe(validators);

    registry.set(activitySelectionAtom, null);

    expect(registry.get(activitySelectedActionAtom)).toBeNull();
    expect(registry.get(activitySelectedYieldAtom)).toBeNull();
    expect(registry.get(activitySelectedValidatorsAtom)).toBeNull();
  });
});
