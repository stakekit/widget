import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";
import {
  type EnterStakeRequest,
  enterStakeRequestAtom,
} from "../../src/features/transaction-flow/state/enter-request";
import {
  type ExitStakeRequest,
  exitStakeRequestAtom,
} from "../../src/features/transaction-flow/state/exit-request";
import {
  type PendingActionRequest,
  pendingActionRequestAtom,
} from "../../src/features/transaction-flow/state/pending-action-request";

describe("transaction flow request atoms", () => {
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
});
