import { Effect, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import {
  getPullResultItems,
  loadAllPages,
  paginatedApiStream,
  withPullPageDone,
} from "../../src/shared/effect/pagination";

describe("shared pagination conventions", () => {
  it("advances from raw envelope metadata when decoded item counts shrink", async () => {
    const fetchPage = vi.fn((offset: number) =>
      Effect.succeed(
        offset === 0
          ? { items: ["valid-0"], limit: 2, offset: 0, total: 3 }
          : { items: ["valid-2"], limit: 2, offset: 2, total: 3 }
      )
    );

    const result = await Effect.runPromise(
      paginatedApiStream({ fetchPage }).pipe(Stream.runCollect)
    );

    expect(result).toEqual([
      { hasNextPage: true, items: ["valid-0"] },
      { hasNextPage: false, items: ["valid-2"] },
    ]);
    expect(fetchPage.mock.calls.map(([offset]) => offset)).toEqual([0, 2]);
  });

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

  it("retains accumulated pull items after the next page fails", async () => {
    const pull = Atom.pull(
      paginatedApiStream({
        fetchPage: (offset) =>
          offset === 0
            ? Effect.succeed({
                items: ["first-page"],
                limit: 1,
                offset: 0,
                total: 2,
              })
            : Effect.fail("second-page-failed"),
      })
    ).pipe(withPullPageDone);
    const registry = AtomRegistry.make();
    const unmount = registry.mount(pull);

    await Effect.runPromise(Effect.yieldNow);
    const first = registry.get(pull);
    expect(AsyncResult.isSuccess(first)).toBe(true);
    expect(getPullResultItems(first).flatMap((page) => page.items)).toEqual([
      "first-page",
    ]);

    registry.set(pull, undefined);
    await Effect.runPromise(Effect.yieldNow);
    const failed = registry.get(pull);
    expect(AsyncResult.isFailure(failed)).toBe(true);
    expect(getPullResultItems(failed).flatMap((page) => page.items)).toEqual([
      "first-page",
    ]);

    unmount();
  });

  it("reports completion with the final API page", async () => {
    const pull = Atom.pull(
      paginatedApiStream({
        fetchPage: () =>
          Effect.succeed({ items: [], limit: 50, offset: 0, total: 0 }),
      })
    ).pipe(withPullPageDone);
    const registry = AtomRegistry.make();
    const unmount = registry.mount(pull);

    await Effect.runPromise(Effect.yieldNow);

    expect(AsyncResult.getOrThrow(registry.get(pull))).toEqual({
      done: true,
      items: [{ hasNextPage: false, items: [] }],
    });

    unmount();
  });
});
