import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import { loadAllPagesByIdChunks } from "../../src/features/earn/state/atoms-state/catalog/utilities";

type Item = {
  id: string;
};

const makeItem = (id: string): Item => ({ id });

describe("loadAllPagesByIdChunks", () => {
  it("splits IDs into bounded chunks", async () => {
    const ids = Array.from({ length: 5 }, (_, index) => `yield-${index}`);
    const fetchPage = vi.fn(({ ids }: { ids: ReadonlyArray<string> }) =>
      Effect.succeed({
        total: ids.length,
        items: ids.map(makeItem),
      })
    );

    const result = await Effect.runPromise(
      loadAllPagesByIdChunks({
        chunkSize: 2,
        concurrency: 2,
        fetchPage,
        getItemId: (item) => item.id,
        ids,
        pageSize: 100,
      })
    );

    expect(result.map((item) => item.id)).toEqual(ids);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage.mock.calls.map(([arg]) => arg.ids)).toEqual([
      ["yield-0", "yield-1"],
      ["yield-2", "yield-3"],
      ["yield-4"],
    ]);
  });

  it("deduplicates requested IDs and returns items in first occurrence order", async () => {
    const fetchPage = vi.fn(({ ids }: { ids: ReadonlyArray<string> }) =>
      Effect.succeed({
        total: ids.length,
        items: [...ids].reverse().map(makeItem),
      })
    );

    const result = await Effect.runPromise(
      loadAllPagesByIdChunks({
        chunkSize: 2,
        concurrency: 2,
        fetchPage,
        getItemId: (item) => item.id,
        ids: ["yield-2", "yield-1", "yield-2", "yield-0"],
        pageSize: 100,
      })
    );

    expect(result.map((item) => item.id)).toEqual([
      "yield-2",
      "yield-1",
      "yield-0",
    ]);
    expect(fetchPage.mock.calls.map(([arg]) => arg.ids)).toEqual([
      ["yield-2", "yield-1"],
      ["yield-0"],
    ]);
  });

  it("loads additional pages for each chunk", async () => {
    const fetchPage = vi.fn(
      ({ ids, offset }: { ids: ReadonlyArray<string>; offset: number }) =>
        Effect.succeed({
          total: ids.length,
          items: ids.slice(offset, offset + 2).map(makeItem),
        })
    );

    const result = await Effect.runPromise(
      loadAllPagesByIdChunks({
        chunkSize: 3,
        concurrency: 2,
        fetchPage,
        getItemId: (item) => item.id,
        ids: ["yield-0", "yield-1", "yield-2"],
        pageSize: 2,
      })
    );

    expect(result.map((item) => item.id)).toEqual([
      "yield-0",
      "yield-1",
      "yield-2",
    ]);
    expect(fetchPage.mock.calls.map(([arg]) => arg.offset)).toEqual([0, 2]);
  });
});
