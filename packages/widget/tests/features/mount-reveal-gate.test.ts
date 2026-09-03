import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isMountRevealSettled,
  makeMountRevealGate,
  observeMountRevealFrame,
} from "../../src/features/mount-animation/model/reveal-gate";
import { mountRevealReadyAtom } from "../../src/features/mount-animation/state/reveal-gate";

const observeFrames = (gaps: ReadonlyArray<number>) =>
  gaps.reduce(
    (current, gap) => {
      const at = current.at + gap;

      return { at, gate: observeMountRevealFrame(current.gate, at) };
    },
    { at: 0, gate: makeMountRevealGate() }
  ).gate;

describe("mount reveal gate model", () => {
  it("needs a baseline frame before any frame can count as quiet", () => {
    expect(isMountRevealSettled(observeFrames([0, 8, 8]))).toBe(false);
    expect(isMountRevealSettled(observeFrames([0, 8, 8, 8]))).toBe(true);
  });

  it("settles on consecutive frames served at display pace", () => {
    expect(isMountRevealSettled(observeFrames([0, 16, 16, 16]))).toBe(true);
  });

  it("restarts the count when a frame absorbs work", () => {
    expect(isMountRevealSettled(observeFrames([0, 8, 8, 47, 8, 8]))).toBe(
      false
    );
    expect(isMountRevealSettled(observeFrames([0, 8, 8, 47, 8, 8, 8]))).toBe(
      true
    );
  });

  it("never settles while every frame stays slow", () => {
    expect(
      isMountRevealSettled(observeFrames([0, 40, 40, 40, 40, 40, 40]))
    ).toBe(false);
  });
});

const revealFloorMillis = 300;
const revealSettleLimitMillis = 300;

type FrameDriver = {
  readonly advance: (byMillis: number) => void;
  readonly pending: () => boolean;
};

const installFrameDriver = (): FrameDriver => {
  let nowMillis = 0;
  let scheduled: FrameRequestCallback | null = null;

  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    scheduled = callback;

    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    scheduled = null;
  });

  return {
    advance: (byMillis) => {
      nowMillis += byMillis;
      const callback = scheduled;
      scheduled = null;
      callback?.(nowMillis);
    },
    pending: () => scheduled !== null,
  };
};

describe("mount reveal gate atom", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("holds the reveal for the floor, then opens on quiet frames", async () => {
    const frames = installFrameDriver();
    const registry = AtomRegistry.make();
    const unmount = registry.mount(mountRevealReadyAtom);

    try {
      await vi.advanceTimersByTimeAsync(revealFloorMillis - 1);
      expect(registry.get(mountRevealReadyAtom)).toBe(false);
      expect(frames.pending()).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      expect(frames.pending()).toBe(true);

      for (let frame = 0; frame < 4; frame += 1) {
        frames.advance(8);
      }
      await vi.advanceTimersByTimeAsync(1);

      expect(registry.get(mountRevealReadyAtom)).toBe(true);
    } finally {
      unmount();
    }
  });

  it("opens at the bounded fallback when frames never arrive", async () => {
    installFrameDriver();
    const registry = AtomRegistry.make();
    const unmount = registry.mount(mountRevealReadyAtom);

    try {
      await vi.advanceTimersByTimeAsync(
        revealFloorMillis + revealSettleLimitMillis - 1
      );
      expect(registry.get(mountRevealReadyAtom)).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      expect(registry.get(mountRevealReadyAtom)).toBe(true);
    } finally {
      unmount();
    }
  });

  it("opens at the bounded fallback when every frame stays starved", async () => {
    const frames = installFrameDriver();
    const registry = AtomRegistry.make();
    const unmount = registry.mount(mountRevealReadyAtom);

    try {
      await vi.advanceTimersByTimeAsync(revealFloorMillis);

      const starvedFrameMillis = 50;
      for (
        let elapsed = 0;
        elapsed < revealSettleLimitMillis - starvedFrameMillis;
        elapsed += starvedFrameMillis
      ) {
        frames.advance(starvedFrameMillis);
        await vi.advanceTimersByTimeAsync(starvedFrameMillis);
      }
      expect(registry.get(mountRevealReadyAtom)).toBe(false);

      frames.advance(starvedFrameMillis);
      await vi.advanceTimersByTimeAsync(starvedFrameMillis);

      expect(registry.get(mountRevealReadyAtom)).toBe(true);
    } finally {
      unmount();
    }
  });

  it("opens at the bounded fallback without requestAnimationFrame", async () => {
    vi.stubGlobal("requestAnimationFrame", undefined);
    const registry = AtomRegistry.make();
    const unmount = registry.mount(mountRevealReadyAtom);

    try {
      await vi.advanceTimersByTimeAsync(
        revealFloorMillis + revealSettleLimitMillis
      );

      expect(registry.get(mountRevealReadyAtom)).toBe(true);
    } finally {
      unmount();
    }
  });

  it("waits again for a freshly mounted widget instance", async () => {
    installFrameDriver();
    const first = AtomRegistry.make();
    const unmountFirst = first.mount(mountRevealReadyAtom);
    await vi.advanceTimersByTimeAsync(
      revealFloorMillis + revealSettleLimitMillis
    );
    expect(first.get(mountRevealReadyAtom)).toBe(true);
    unmountFirst();

    const second = AtomRegistry.make();
    const unmountSecond = second.mount(mountRevealReadyAtom);

    try {
      expect(second.get(mountRevealReadyAtom)).toBe(false);
    } finally {
      unmountSecond();
    }
  });
});
