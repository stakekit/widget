import { Duration, Effect, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { withApiResourcePolicy } from "../../../src/shared/effect/api-resource";

describe("shared API resource conventions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retains a prior value after failure and retries only when refreshed", () => {
    let runs = 0;
    const source = Atom.make(
      Effect.suspend(() => {
        runs += 1;
        return runs === 2
          ? Effect.fail("refresh-failed")
          : Effect.succeed(runs);
      })
    );
    const resource = withApiResourcePolicy({
      staleTime: Duration.minutes(1),
    })(source);
    const registry = AtomRegistry.make();
    const unmount = registry.mount(resource);

    expect(AsyncResult.getOrThrow(registry.get(resource))).toBe(1);
    registry.refresh(resource);

    const failed = registry.get(resource);
    expect(AsyncResult.isFailure(failed)).toBe(true);
    expect(Option.getOrThrow(AsyncResult.value(failed))).toBe(1);
    expect(runs).toBe(2);

    registry.refresh(resource);
    expect(AsyncResult.getOrThrow(registry.get(resource))).toBe(3);
    expect(runs).toBe(3);
    unmount();
  });

  it("evicts an unmounted resource after its idle lifetime", async () => {
    let runs = 0;
    const source = Atom.make(Effect.sync(() => ++runs));
    const resource = withApiResourcePolicy({
      staleTime: Duration.minutes(1),
    })(source);
    const registry = AtomRegistry.make({ timeoutResolution: 1 });

    expect(AsyncResult.getOrThrow(registry.get(resource))).toBe(1);
    await vi.advanceTimersByTimeAsync(
      Duration.toMillis(Duration.minutes(5)) + 1
    );
    // The idle sweep removes the resource; its source node is released on the
    // registry's next scheduled task.
    await vi.runOnlyPendingTimersAsync();
    expect(AsyncResult.getOrThrow(registry.get(resource))).toBe(2);
  });
});
