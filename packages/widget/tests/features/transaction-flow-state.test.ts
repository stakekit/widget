import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";
import { makeTransactionWorkflowLifecycleAtom } from "../../src/features/transaction-flow/state/workflow-lifecycle";

describe("transaction workflow lifecycle", () => {
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
});
