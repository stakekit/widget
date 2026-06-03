import { useDebouncedValue } from "../../src/hooks/use-debounced-value";
import { describe, expect, it, vi } from "../utils/test-extend";
import { renderHook } from "../utils/test-utils";

describe("useDebouncedValue", () => {
  it("updates only after the debounce delay", async () => {
    vi.useFakeTimers();

    try {
      const hook = await renderHook(
        (props) => useDebouncedValue(props?.value ?? "", 300),
        { initialProps: { value: "" } }
      );

      expect(hook.result.current).toBe("");

      await hook.rerender({ value: "ta" });

      expect(hook.result.current).toBe("");

      await hook.act(() => vi.advanceTimersByTime(299));

      expect(hook.result.current).toBe("");

      await hook.act(() => vi.advanceTimersByTime(1));

      expect(hook.result.current).toBe("ta");
    } finally {
      vi.useRealTimers();
    }
  });
});
