import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDelayedBusy } from "../../src/shared/react/use-delayed-busy";
import { renderHook } from "../utils/test-utils.dom.tsx";

const showAfterMillis = 500;
const minVisibleMillis = 200;

type Wait = { readonly busy: boolean; readonly waitKey: string };

const renderDelayedBusy = (initialProps: Wait) =>
  renderHook(({ busy, waitKey }: Wait) => useDelayedBusy(busy, waitKey), {
    initialProps,
  });

const advance = async (
  hook: Awaited<ReturnType<typeof renderDelayedBusy>>,
  millis: number
) => {
  await hook.act(async () => {
    await vi.advanceTimersByTimeAsync(millis);
  });
};

describe("useDelayedBusy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays hidden until the wait outlives the delay", async () => {
    const hook = await renderDelayedBusy({ busy: true, waitKey: "90d" });

    expect(hook.result.current).toBe(false);

    await advance(hook, showAfterMillis - 1);
    expect(hook.result.current).toBe(false);

    await advance(hook, 1);
    expect(hook.result.current).toBe(true);
  });

  it("shows nothing when the wait ends before the delay", async () => {
    const hook = await renderDelayedBusy({ busy: true, waitKey: "90d" });

    await advance(hook, showAfterMillis - 200);
    await hook.rerender({ busy: false, waitKey: "90d" });
    await advance(hook, showAfterMillis);

    expect(hook.result.current).toBe(false);
  });

  it("keeps chrome for the minimum visible time once shown", async () => {
    const hook = await renderDelayedBusy({ busy: true, waitKey: "90d" });

    await advance(hook, showAfterMillis);
    await hook.rerender({ busy: false, waitKey: "90d" });
    expect(hook.result.current).toBe(true);

    await advance(hook, minVisibleMillis - 1);
    expect(hook.result.current).toBe(true);

    await advance(hook, 1);
    expect(hook.result.current).toBe(false);
  });

  it("hides at once and waits again when the wait key changes", async () => {
    const hook = await renderDelayedBusy({ busy: true, waitKey: "90d" });

    await advance(hook, showAfterMillis);
    await hook.rerender({ busy: true, waitKey: "1y" });
    expect(hook.result.current).toBe(false);

    await advance(hook, showAfterMillis - 1);
    expect(hook.result.current).toBe(false);

    await advance(hook, 1);
    expect(hook.result.current).toBe(true);
  });

  it("waits again when an earlier wait key is selected back", async () => {
    const hook = await renderDelayedBusy({ busy: true, waitKey: "90d" });

    await advance(hook, showAfterMillis);
    await hook.rerender({ busy: true, waitKey: "1y" });
    await advance(hook, 100);
    await hook.rerender({ busy: true, waitKey: "90d" });
    expect(hook.result.current).toBe(false);

    await advance(hook, showAfterMillis - 1);
    expect(hook.result.current).toBe(false);

    await advance(hook, 1);
    expect(hook.result.current).toBe(true);
  });

  it("waits again when the same wait key runs a second time", async () => {
    const hook = await renderDelayedBusy({ busy: true, waitKey: "90d" });

    await advance(hook, showAfterMillis);
    await hook.rerender({ busy: false, waitKey: "90d" });
    await advance(hook, minVisibleMillis);
    expect(hook.result.current).toBe(false);

    await hook.rerender({ busy: true, waitKey: "90d" });
    await advance(hook, showAfterMillis - 1);
    expect(hook.result.current).toBe(false);

    await advance(hook, 1);
    expect(hook.result.current).toBe(true);
  });

  it("never accumulates a burst of wait keys toward chrome", async () => {
    const hook = await renderDelayedBusy({ busy: true, waitKey: "30d" });

    await advance(hook, 200);
    await hook.rerender({ busy: true, waitKey: "90d" });
    await advance(hook, 200);
    await hook.rerender({ busy: true, waitKey: "1y" });

    await advance(hook, showAfterMillis - 1);
    expect(hook.result.current).toBe(false);

    await advance(hook, 1);
    expect(hook.result.current).toBe(true);
  });

  it("drops a running hold when a new wait key arrives", async () => {
    const hook = await renderDelayedBusy({ busy: true, waitKey: "90d" });

    await advance(hook, showAfterMillis);
    await hook.rerender({ busy: false, waitKey: "90d" });
    await hook.rerender({ busy: true, waitKey: "1y" });
    expect(hook.result.current).toBe(false);

    await advance(hook, minVisibleMillis);
    expect(hook.result.current).toBe(false);

    await advance(hook, showAfterMillis - minVisibleMillis);
    expect(hook.result.current).toBe(true);
  });
});
