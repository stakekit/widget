import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import { loadAllPages } from "../../src/shared/effect/pagination";

describe("shared pagination conventions", () => {
  it("loads every source page from the raw total", async () => {
    const fetchPage = vi.fn((offset: number) =>
      Effect.succeed(
        offset === 0
          ? { items: ["valid-0"], total: 3 }
          : { items: ["valid-2"], total: 3 }
      )
    );

    const result = await Effect.runPromise(
      loadAllPages({ concurrency: 2, fetchPage, pageSize: 2 })
    );

    expect(result).toEqual(["valid-0", "valid-2"]);
    expect(fetchPage.mock.calls.map(([offset]) => offset)).toEqual([0, 2]);
  });

  it("advances by the backend page size when it caps the requested limit", async () => {
    const items = ["item-0", "item-1", "item-2", "item-3", "item-4"];
    const fetchPage = vi.fn((offset: number) =>
      Effect.succeed({
        items: items.slice(offset, offset + 2),
        limit: 2,
        offset,
        total: items.length,
      })
    );

    const result = await Effect.runPromise(
      loadAllPages({ concurrency: 2, fetchPage, pageSize: 100 })
    );

    expect(result).toEqual(items);
    expect(fetchPage.mock.calls.map(([offset]) => offset)).toEqual([0, 2, 4]);
  });
});
