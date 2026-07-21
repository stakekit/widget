import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";
import {
  actionHistoryTimestampAtom,
  markActionHistoryChanged,
  resetActionHistory,
} from "../../src/features/classic-transaction-flow/state/action-history";

describe("action history atoms", () => {
  it("initializes, updates, and resets explicitly", () => {
    const registry = AtomRegistry.make();

    expect(registry.get(actionHistoryTimestampAtom)).toBeNull();

    registry.set(actionHistoryTimestampAtom, markActionHistoryChanged(123));
    expect(registry.get(actionHistoryTimestampAtom)).toBe(123);

    registry.set(actionHistoryTimestampAtom, resetActionHistory());
    expect(registry.get(actionHistoryTimestampAtom)).toBeNull();
  });
});
