import { Data, Duration, Effect, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withApiResourcePolicy } from "../../src/shared/effect/api-resource";

class ResourceKey extends Data.Class<{
  readonly network: string;
  readonly page: number;
}> {}

describe("shared API resource conventions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("deduplicates atom-family instances by value-equal keys", () => {
    let constructions = 0;
    const family = Atom.family((key: ResourceKey) => {
      constructions += 1;
      return Atom.make(`${key.network}:${key.page}`);
    });

    const first = family(new ResourceKey({ network: "ethereum", page: 1 }));
    const equivalent = family(
      new ResourceKey({ network: "ethereum", page: 1 })
    );
    const different = family(new ResourceKey({ network: "ethereum", page: 2 }));

    expect(equivalent).toBe(first);
    expect(different).not.toBe(first);
    expect(constructions).toBe(2);
  });

  it("applies SWR and idle lifetime policy to async resources", () => {
    const source = Atom.make(AsyncResult.success(1));
    const resource = withApiResourcePolicy({
      staleTime: Duration.seconds(30),
      idleTTL: Duration.minutes(3),
      revalidateOnMount: true,
    })(source);

    expect(resource.idleTTL).toBe(Duration.toMillis(Duration.minutes(3)));
  });

  it("revalidates on focus only after a resource becomes stale", async () => {
    let runs = 0;
    const focusSignal = Atom.make(0);
    const source = Atom.make(Effect.sync(() => ++runs));
    const resource = withApiResourcePolicy({
      staleTime: Duration.millis(100),
      idleTTL: Duration.seconds(5),
      revalidateOnFocus: true,
      focusSignal,
    })(source);
    const registry = AtomRegistry.make();

    const unmount = registry.mount(resource);
    expect(AsyncResult.getOrThrow(registry.get(resource))).toBe(1);

    await vi.advanceTimersByTimeAsync(50);
    registry.set(focusSignal, 1);
    expect(AsyncResult.getOrThrow(registry.get(resource))).toBe(1);
    expect(runs).toBe(1);

    await vi.advanceTimersByTimeAsync(51);
    registry.set(focusSignal, 2);

    expect(AsyncResult.getOrThrow(registry.get(resource))).toBe(2);
    expect(runs).toBe(2);
    unmount();
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
      idleTTL: Duration.minutes(5),
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
      idleTTL: Duration.millis(50),
    })(source);
    const registry = AtomRegistry.make({ timeoutResolution: 1 });

    expect(AsyncResult.getOrThrow(registry.get(resource))).toBe(1);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(100);
    expect(AsyncResult.getOrThrow(registry.get(resource))).toBe(2);
  });
});
