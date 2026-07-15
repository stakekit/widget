import BigNumber from "bignumber.js";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";
import {
  makePositionDetailsWorkflowState,
  positionDetailsWorkflowAtom,
  reducePositionDetailsWorkflow,
} from "../../src/features/position-details/state";

describe("position details workflow atoms", () => {
  it("owns amount transitions and resets in the registry", () => {
    const registry = AtomRegistry.make();
    const changed = reducePositionDetailsWorkflow({
      action: { type: "unstake/amount/change", data: new BigNumber(2) },
      maxUnstakeAmount: new BigNumber(10),
      state: registry.get(positionDetailsWorkflowAtom),
    });

    registry.set(positionDetailsWorkflowAtom, changed);
    expect(
      registry.get(positionDetailsWorkflowAtom).unstakeAmount.toFixed()
    ).toBe("2");
    expect(registry.get(positionDetailsWorkflowAtom).unstakeUseMaxAmount).toBe(
      false
    );

    const maximum = reducePositionDetailsWorkflow({
      action: { type: "unstake/amount/max" },
      maxUnstakeAmount: new BigNumber(10),
      state: registry.get(positionDetailsWorkflowAtom),
    });
    registry.set(positionDetailsWorkflowAtom, maximum);

    expect(
      registry.get(positionDetailsWorkflowAtom).unstakeAmount.toFixed()
    ).toBe("10");
    expect(registry.get(positionDetailsWorkflowAtom).unstakeUseMaxAmount).toBe(
      true
    );

    registry.set(
      positionDetailsWorkflowAtom,
      makePositionDetailsWorkflowState(new BigNumber(1))
    );

    expect(
      registry.get(positionDetailsWorkflowAtom).unstakeAmount.toFixed()
    ).toBe("1");
    expect(registry.get(positionDetailsWorkflowAtom).pendingActions.size).toBe(
      0
    );
  });
});
