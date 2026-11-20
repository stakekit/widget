import { Effect, Layer, Schema } from "effect";
import { Atom, AtomRegistry } from "effect/reactivity";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WalletAddress } from "../../../src/domain/identity/identifiers";
import {
  ActionSimulationKey,
  actionSimulationResourceAtom,
} from "../../../src/resources/action-simulation/action-simulation";
import { appRuntime } from "../../../src/runtime/app-runtime";
import {
  type ActionSimulationRequest,
  YieldResourceSource,
} from "../../../src/services/api/resource-sources";
import { yieldApiYieldFixture } from "../../fixtures";

const address = Schema.decodeSync(WalletAddress)(
  "0x1234567890123456789012345678901234567890"
);

const keyFor = (amount: string) =>
  new ActionSimulationKey({
    request: {
      command: {
        address,
        arguments: { amount },
        yieldId: yieldApiYieldFixture().id,
      },
      intent: "enter",
    },
  });

const makeRegistry = (
  simulateAction: (request: ActionSimulationRequest) => Effect.Effect<never>
) =>
  AtomRegistry.make({
    initialValues: [
      Atom.initialValue(
        appRuntime.layer,
        Layer.succeed(
          YieldResourceSource,
          YieldResourceSource.of({ simulateAction } as never)
        )
      ),
    ],
  });

describe("Action Simulation resource", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("simulates only the amount the user settled on, not each one typed before it", async () => {
    const simulateAction = vi.fn(
      (_request: ActionSimulationRequest) => Effect.never
    );
    const registry = makeRegistry(simulateAction);

    // Typing "1", then "12": the first amount stops being read before its
    // debounce ends, which interrupts its wait.
    const unmountFirst = registry.mount(
      actionSimulationResourceAtom.local(keyFor("1"))
    );
    await vi.advanceTimersByTimeAsync(200);
    unmountFirst();
    registry.mount(actionSimulationResourceAtom.local(keyFor("12")));
    await vi.advanceTimersByTimeAsync(400);

    expect(simulateAction).toHaveBeenCalledTimes(1);
    expect(simulateAction.mock.calls[0]?.[0].command.arguments).toEqual({
      amount: "12",
    });
  });

  it("waits for the amount to settle before asking the API", async () => {
    const simulateAction = vi.fn(
      (_request: ActionSimulationRequest) => Effect.never
    );
    const registry = makeRegistry(simulateAction);

    registry.mount(actionSimulationResourceAtom.local(keyFor("5")));
    await vi.advanceTimersByTimeAsync(399);
    expect(simulateAction).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(simulateAction).toHaveBeenCalledTimes(1);
  });
});
