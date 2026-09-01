import { describe, expect, it, vi } from "@effect/vitest";
import { Effect } from "effect";
import { loadAllPages } from "../../src/shared/effect/pagination";

describe("shared pagination conventions", () => {
  it.effect("loads every source page from the raw total", () =>
    Effect.gen(function* () {
      const fetchPage = vi.fn((offset: number) =>
        Effect.succeed(
          offset === 0
            ? { items: ["valid-0"], total: 3 }
            : { items: ["valid-2"], total: 3 }
        )
      );

      const result = yield* loadAllPages({
        concurrency: 2,
        fetchPage,
        pageSize: 2,
      });

      expect(result).toEqual(["valid-0", "valid-2"]);
      expect(fetchPage.mock.calls.map(([offset]) => offset)).toEqual([0, 2]);
    })
  );

  it.effect(
    "advances by the backend page size when it caps the requested limit",
    () =>
      Effect.gen(function* () {
        const items = ["item-0", "item-1", "item-2", "item-3", "item-4"];
        const fetchPage = vi.fn((offset: number) =>
          Effect.succeed({
            items: items.slice(offset, offset + 2),
            limit: 2,
            offset,
            total: items.length,
          })
        );

        const result = yield* loadAllPages({
          concurrency: 2,
          fetchPage,
          pageSize: 100,
        });

        expect(result).toEqual(items);
        expect(fetchPage.mock.calls.map(([offset]) => offset)).toEqual([
          0, 2, 4,
        ]);
      })
  );
});
