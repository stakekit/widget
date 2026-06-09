import { describe, expect, it, vi } from "vitest";
import {
  fetchAllYieldSummaries,
  fetchYieldSummariesByIds,
  isVisibleYieldSummary,
  type YieldSummary,
} from "../../src/hooks/api/use-yield-summaries";
import type { ApiClient } from "../../src/providers/api/api-client";
import { yieldApiYieldFixture, yieldRewardRateFixture } from "../fixtures";

const summary = (overrides?: Parameters<typeof yieldApiYieldFixture>[0]) =>
  yieldApiYieldFixture(overrides) as YieldSummary;

describe("isVisibleYieldSummary", () => {
  it("includes enterable, supported-chain, non-zero-reward summaries", () => {
    expect(isVisibleYieldSummary(summary())).toBe(true);
  });

  it("excludes summaries that are not enterable", () => {
    expect(
      isVisibleYieldSummary(summary({ status: { enter: false, exit: true } }))
    ).toBe(false);
  });

  it("excludes summaries with a zero reward rate", () => {
    expect(
      isVisibleYieldSummary(
        summary({ rewardRate: yieldRewardRateFixture({ total: 0 }) })
      )
    ).toBe(false);
  });

  it("includes whitelisted zero-reward summaries", () => {
    expect(
      isVisibleYieldSummary(
        summary({
          id: "optimism-usdc-gtusdcb-0x4ffc4e5f1f1f5c43dc9bc27b53728da13b02be35-4626-vault",
          token: {
            name: "USD Coin",
            symbol: "USDC",
            decimals: 6,
            network: "optimism",
          },
          rewardRate: yieldRewardRateFixture({ total: 0 }),
        })
      )
    ).toBe(true);
  });
});

describe("fetchAllYieldSummaries", () => {
  it("loops offset until all pages are fetched", async () => {
    const items = Array.from({ length: 5 }, (_, index) =>
      summary({ id: `yield-${index}` })
    );

    const getYields = vi.fn(
      async ({ params }: { params: { offset?: number; limit?: number } }) => {
        const offset = params.offset ?? 0;
        const limit = params.limit ?? 2;

        return {
          total: items.length,
          offset,
          limit,
          items: items.slice(offset, offset + limit),
        };
      }
    );

    const apiClient = {
      withOptions: () => ({ yield: { YieldsControllerGetYields: getYields } }),
    } as unknown as ApiClient;

    const result = await fetchAllYieldSummaries({
      apiClient,
      params: { network: "ethereum", limit: 2 },
    });

    expect(result.map((item) => item.id)).toEqual([
      "yield-0",
      "yield-1",
      "yield-2",
      "yield-3",
      "yield-4",
    ]);
    expect(getYields).toHaveBeenCalledTimes(3);
    expect(getYields.mock.calls.map(([arg]) => arg.params.offset)).toEqual([
      0, 2, 4,
    ]);
  });

  it("stops when the API returns an empty page", async () => {
    const getYields = vi.fn(async () => ({
      total: 100,
      offset: 0,
      limit: 50,
      items: [],
    }));

    const apiClient = {
      withOptions: () => ({ yield: { YieldsControllerGetYields: getYields } }),
    } as unknown as ApiClient;

    const result = await fetchAllYieldSummaries({
      apiClient,
      params: { network: "ethereum" },
    });

    expect(result).toEqual([]);
    expect(getYields).toHaveBeenCalledTimes(1);
  });
});

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
