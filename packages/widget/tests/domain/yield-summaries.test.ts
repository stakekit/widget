import { describe, expect, it, vi } from "vitest";
import type { YieldDto } from "../../src/generated/api/yield";
import { fetchYieldSummariesByIds } from "../../src/hooks/api/use-yield-summaries";
import type { ApiClient } from "../../src/providers/api/api-client";
import { yieldApiYieldFixture } from "../fixtures";

const summary = (overrides?: Parameters<typeof yieldApiYieldFixture>[0]) =>
  yieldApiYieldFixture(overrides) as YieldDto;

describe("fetchYieldSummariesByIds", () => {
  it("splits yield IDs into bounded chunks", async () => {
    const items = Array.from({ length: 5 }, (_, index) =>
      summary({ id: `yield-${index}` })
    );

    const getYields = vi.fn(
      async ({ params }: { params: { yieldIds: ReadonlyArray<string> } }) => ({
        total: params.yieldIds.length,
        offset: 0,
        limit: params.yieldIds.length,
        items: params.yieldIds.flatMap(
          (yieldId) => items.find((item) => item.id === yieldId) ?? []
        ),
      })
    );

    const apiClient = {
      withOptions: () => ({ yield: { YieldsControllerGetYields: getYields } }),
    } as unknown as ApiClient;

    const result = await fetchYieldSummariesByIds({
      apiClient,
      chunkSize: 2,
      yieldIds: items.map((item) => item.id),
    });

    expect(result.map((item) => item.id)).toEqual([
      "yield-0",
      "yield-1",
      "yield-2",
      "yield-3",
      "yield-4",
    ]);
    expect(getYields).toHaveBeenCalledTimes(3);
    expect(getYields.mock.calls.map(([arg]) => arg.params.yieldIds)).toEqual([
      ["yield-0", "yield-1"],
      ["yield-2", "yield-3"],
      ["yield-4"],
    ]);
  });

  it("uses a single request when IDs fit within the chunk size", async () => {
    const getYields = vi.fn(async () => ({
      total: 2,
      offset: 0,
      limit: 2,
      items: [summary({ id: "yield-0" }), summary({ id: "yield-1" })],
    }));

    const apiClient = {
      withOptions: () => ({ yield: { YieldsControllerGetYields: getYields } }),
    } as unknown as ApiClient;

    await fetchYieldSummariesByIds({
      apiClient,
      chunkSize: 2,
      yieldIds: ["yield-0", "yield-1"],
    });

    expect(getYields).toHaveBeenCalledTimes(1);
    expect(getYields).toHaveBeenCalledWith({
      params: {
        yieldIds: ["yield-0", "yield-1"],
        limit: 2,
      },
    });
  });

  it("deduplicates requested IDs and returns summaries in first occurrence order", async () => {
    const getYields = vi.fn(
      async ({ params }: { params: { yieldIds: ReadonlyArray<string> } }) => ({
        total: params.yieldIds.length,
        offset: 0,
        limit: params.yieldIds.length,
        items: [...params.yieldIds]
          .reverse()
          .map((yieldId) => summary({ id: yieldId })),
      })
    );

    const apiClient = {
      withOptions: () => ({ yield: { YieldsControllerGetYields: getYields } }),
    } as unknown as ApiClient;

    const result = await fetchYieldSummariesByIds({
      apiClient,
      chunkSize: 2,
      yieldIds: ["yield-2", "yield-1", "yield-2", "yield-0"],
    });

    expect(result.map((item) => item.id)).toEqual([
      "yield-2",
      "yield-1",
      "yield-0",
    ]);
    expect(getYields.mock.calls.map(([arg]) => arg.params.yieldIds)).toEqual([
      ["yield-2", "yield-1"],
      ["yield-0"],
    ]);
  });
});
