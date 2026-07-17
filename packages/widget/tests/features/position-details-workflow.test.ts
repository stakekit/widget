import BigNumber from "bignumber.js";
import { Schema } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import {
  makePositionDetailsWorkflowState,
  PositionDetailsWorkflowKey,
  positionDetailsWorkflowAtom,
  reducePositionDetailsWorkflow,
} from "../../src/features/position-details/state";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";

const scopeA = new WalletScopeKey({
  address: Schema.decodeSync(WalletAddress)(
    "0x0000000000000000000000000000000000000001"
  ),
  network: "ethereum",
});
const scopeB = new WalletScopeKey({
  address: Schema.decodeSync(WalletAddress)(
    "0x0000000000000000000000000000000000000002"
  ),
  network: "ethereum",
});

const workflowAtom = positionDetailsWorkflowAtom(
  new PositionDetailsWorkflowKey({
    balanceId: "balance-1",
    integrationId: "yield-1",
    pendingActionType: null,
    scope: scopeA,
  })
);

describe("position details workflow atoms", () => {
  it("owns amount transitions and resets in the registry", () => {
    const registry = AtomRegistry.make();
    const changed = reducePositionDetailsWorkflow({
      action: { type: "unstake/amount/change", data: new BigNumber(2) },
      maxUnstakeAmount: new BigNumber(10),
      state: registry.get(workflowAtom),
    });

    registry.set(workflowAtom, changed);
    expect(registry.get(workflowAtom).unstakeAmount.toFixed()).toBe("2");
    expect(registry.get(workflowAtom).unstakeUseMaxAmount).toBe(false);

    const maximum = reducePositionDetailsWorkflow({
      action: { type: "unstake/amount/max" },
      maxUnstakeAmount: new BigNumber(10),
      state: registry.get(workflowAtom),
    });
    registry.set(workflowAtom, maximum);

    expect(registry.get(workflowAtom).unstakeAmount.toFixed()).toBe("10");
    expect(registry.get(workflowAtom).unstakeUseMaxAmount).toBe(true);

    registry.set(
      workflowAtom,
      makePositionDetailsWorkflowState(new BigNumber(1))
    );

    expect(registry.get(workflowAtom).unstakeAmount.toFixed()).toBe("1");
    expect(registry.get(workflowAtom).pendingActions.size).toBe(0);
  });

  it("selects fresh action state when only the wallet owner changes", () => {
    const registry = AtomRegistry.make();
    registry.set(
      workflowAtom,
      makePositionDetailsWorkflowState(new BigNumber(5))
    );
    const walletBWorkflow = positionDetailsWorkflowAtom(
      new PositionDetailsWorkflowKey({
        balanceId: "balance-1",
        integrationId: "yield-1",
        pendingActionType: null,
        scope: scopeB,
      })
    );

    expect(walletBWorkflow).not.toBe(workflowAtom);
    expect(registry.get(walletBWorkflow).unstakeAmount.toFixed()).toBe("0");
    expect(registry.get(walletBWorkflow).pendingActions.size).toBe(0);
  });
});
