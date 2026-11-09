import { describe, expect, it, vi } from "@effect/vitest";
import { Effect } from "effect";

import {
  loadAllPages,
  loadAllPagesByIdChunks,
} from "../../../src/shared/effect/pagination";

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

type Item = {
  id: string;
};

const makeItem = (id: string): Item => ({ id });

describe("loadAllPagesByIdChunks", () => {
  it.effect("splits IDs into bounded chunks", () =>
    Effect.gen(function* () {
      const ids = Array.from({ length: 5 }, (_, index) => `yield-${index}`);
      const fetchPage = vi.fn(({ ids }: { ids: ReadonlyArray<string> }) =>
        Effect.succeed({
          total: ids.length,
          items: ids.map(makeItem),
        })
      );

      const result = yield* loadAllPagesByIdChunks({
        chunkSize: 2,
        concurrency: 2,
        fetchPage,
        getItemId: (item) => item.id,
        ids,
        pageSize: 100,
      });

      expect(result.map((item) => item.id)).toEqual(ids);
      expect(fetchPage).toHaveBeenCalledTimes(3);
      expect(fetchPage.mock.calls.map(([arg]) => arg.ids)).toEqual([
        ["yield-0", "yield-1"],
        ["yield-2", "yield-3"],
        ["yield-4"],
      ]);
    })
  );

  it.effect(
    "deduplicates requested IDs and returns items in first occurrence order",
    () =>
      Effect.gen(function* () {
        const fetchPage = vi.fn(({ ids }: { ids: ReadonlyArray<string> }) =>
          Effect.succeed({
            total: ids.length,
            items: [...ids].reverse().map(makeItem),
          })
        );

        const result = yield* loadAllPagesByIdChunks({
          chunkSize: 2,
          concurrency: 2,
          fetchPage,
          getItemId: (item) => item.id,
          ids: ["yield-2", "yield-1", "yield-2", "yield-0"],
          pageSize: 100,
        });

        expect(result.map((item) => item.id)).toEqual([
          "yield-2",
          "yield-1",
          "yield-0",
        ]);
        expect(fetchPage.mock.calls.map(([arg]) => arg.ids)).toEqual([
          ["yield-2", "yield-1"],
          ["yield-0"],
        ]);
      })
  );

  it.effect("loads additional pages for each chunk", () =>
    Effect.gen(function* () {
      const fetchPage = vi.fn(
        ({ ids, offset }: { ids: ReadonlyArray<string>; offset: number }) =>
          Effect.succeed({
            total: ids.length,
            items: ids.slice(offset, offset + 2).map(makeItem),
          })
      );

      const result = yield* loadAllPagesByIdChunks({
        chunkSize: 3,
        concurrency: 2,
        fetchPage,
        getItemId: (item) => item.id,
        ids: ["yield-0", "yield-1", "yield-2"],
        pageSize: 2,
      });

      expect(result.map((item) => item.id)).toEqual([
        "yield-0",
        "yield-1",
        "yield-2",
      ]);
      expect(fetchPage.mock.calls.map(([arg]) => arg.offset)).toEqual([0, 2]);
    })
  );
});
