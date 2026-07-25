import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";
import {
  actionHistoryRevisionAtom,
  incrementActionHistoryRevision,
  resetActionHistoryRevision,
} from "../../src/features/classic-transaction-flow/state";

describe("action history atoms", () => {
  it("initializes, updates, and resets explicitly", () => {
    const registry = AtomRegistry.make();

    expect(registry.get(actionHistoryRevisionAtom)).toBe(0);

    registry.set(
      actionHistoryRevisionAtom,
      incrementActionHistoryRevision(registry.get(actionHistoryRevisionAtom))
    );
    expect(registry.get(actionHistoryRevisionAtom)).toBe(1);

    registry.set(actionHistoryRevisionAtom, resetActionHistoryRevision());
    expect(registry.get(actionHistoryRevisionAtom)).toBe(0);
  });
});
