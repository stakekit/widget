import { DateTime } from "effect";
import { AtomRegistry } from "effect/unstable/reactivity";
import { afterEach, describe, expect, it, vi } from "vitest";
import { presentationClockAtom } from "../../src/shared/effect/presentation-clock";

describe("presentation clock", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("publishes immediately and refreshes once per minute while observed", async () => {
    vi.useFakeTimers();
    const initial = DateTime.makeUnsafe("2026-07-23T12:00:00.000Z");
    vi.setSystemTime(DateTime.toEpochMillis(initial));
    const registry = AtomRegistry.make();
    const unmount = registry.mount(presentationClockAtom);

    await vi.advanceTimersByTimeAsync(0);
    const first = registry.get(presentationClockAtom);
    expect(first).not.toBeNull();
    expect(first && DateTime.formatIso(first.now)).toBe(
      "2026-07-23T12:00:00.000Z"
    );

    await vi.advanceTimersByTimeAsync(60_000);
    const second = registry.get(presentationClockAtom);
    expect(second && DateTime.formatIso(second.now)).toBe(
      "2026-07-23T12:01:00.000Z"
    );

    unmount();
    registry.dispose();
  });
});
