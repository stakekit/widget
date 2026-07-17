import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";
import {
  type EnterStakeRequest,
  enterStakeRequestAtom,
  enterTransactionWorkflowKeyAtom,
} from "../../src/features/transaction-flow/state/enter-request";
import {
  type ExitStakeRequest,
  exitStakeRequestAtom,
  exitTransactionWorkflowKeyAtom,
} from "../../src/features/transaction-flow/state/exit-request";
import {
  type PendingActionRequest,
  pendingActionRequestAtom,
  pendingTransactionWorkflowKeyAtom,
} from "../../src/features/transaction-flow/state/pending-action-request";
import { makeTransactionWorkflowLifecycleAtom } from "../../src/features/transaction-flow/state/workflow-lifecycle";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
import { yieldApiActionFixture } from "../fixtures";

describe("transaction flow request atoms", () => {
  it("does not let a stale lifecycle finalizer clear a newer flow", () => {
    const scheduledTasks: Array<() => void> = [];
    const registry = AtomRegistry.make({
      scheduleTask: (task) => {
        let active = true;
        scheduledTasks.push(() => {
          if (active) task();
        });
        return () => {
          active = false;
        };
      },
    });
    const firstInput = { id: "first" };
    const secondInput = { id: "second" };
    const workflowInputAtom = Atom.make<typeof firstInput | null>(
      firstInput
    ).pipe(Atom.keepAlive);
    const lifecycleAtom = makeTransactionWorkflowLifecycleAtom(
      workflowInputAtom,
      "staleFinalizerWorkflowLifecycleAtom"
    );

    const unmount = registry.mount(lifecycleAtom);
    unmount();
    registry.set(workflowInputAtom, secondInput);

    while (scheduledTasks.length > 0) {
      scheduledTasks.shift()?.();
    }

    expect(registry.get(workflowInputAtom)).toBe(secondInput);
  });

  it("supports initialization, transitions, resets, and fresh registries", () => {
    const firstRegistry = AtomRegistry.make();
    const remountedRegistry = AtomRegistry.make();
    const enterRequest = { flow: "enter" } as unknown as EnterStakeRequest;
    const exitRequest = { flow: "exit" } as unknown as ExitStakeRequest;
    const pendingRequest = {
      flow: "pending-action",
    } as unknown as PendingActionRequest;

    expect(firstRegistry.get(enterStakeRequestAtom)).toBeNull();
    expect(firstRegistry.get(exitStakeRequestAtom)).toBeNull();
    expect(firstRegistry.get(pendingActionRequestAtom)).toBeNull();

    firstRegistry.set(enterStakeRequestAtom, enterRequest);
    firstRegistry.set(exitStakeRequestAtom, exitRequest);
    firstRegistry.set(pendingActionRequestAtom, pendingRequest);

    expect(firstRegistry.get(enterStakeRequestAtom)).toBe(enterRequest);
    expect(firstRegistry.get(exitStakeRequestAtom)).toBe(exitRequest);
    expect(firstRegistry.get(pendingActionRequestAtom)).toBe(pendingRequest);

    expect(remountedRegistry.get(enterStakeRequestAtom)).toBeNull();
    expect(remountedRegistry.get(exitStakeRequestAtom)).toBeNull();
    expect(remountedRegistry.get(pendingActionRequestAtom)).toBeNull();

    firstRegistry.set(enterStakeRequestAtom, null);
    firstRegistry.set(exitStakeRequestAtom, null);
    firstRegistry.set(pendingActionRequestAtom, null);

    expect(firstRegistry.get(enterStakeRequestAtom)).toBeNull();
    expect(firstRegistry.get(exitStakeRequestAtom)).toBeNull();
    expect(firstRegistry.get(pendingActionRequestAtom)).toBeNull();
  });

  it("uses the captured wallet scope instead of reclassifying API token networks", () => {
    const registry = AtomRegistry.make();
    const actionDto = yieldApiActionFixture();
    const walletScope = new WalletScopeKey({
      address: actionDto.address!,
      network: "ethereum",
    });
    const apiToken = { network: "starknet" };

    registry.set(enterStakeRequestAtom, {
      actionDto,
      providersDetails: [],
      selectedToken: apiToken,
      walletScope,
    } as unknown as EnterStakeRequest);
    registry.set(exitStakeRequestAtom, {
      actionDto,
      providersDetails: [],
      unstakeToken: apiToken,
      walletScope,
    } as unknown as ExitStakeRequest);
    registry.set(pendingActionRequestAtom, {
      actionDto,
      interactedToken: apiToken,
      providersDetails: [],
      walletScope,
    } as unknown as PendingActionRequest);

    expect(registry.get(enterTransactionWorkflowKeyAtom)?.walletScope).toBe(
      walletScope
    );
    expect(registry.get(exitTransactionWorkflowKeyAtom)?.walletScope).toBe(
      walletScope
    );
    expect(registry.get(pendingTransactionWorkflowKeyAtom)?.walletScope).toBe(
      walletScope
    );
  });
});
