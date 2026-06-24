import { describe, expect, it, vi } from "vitest";
import type { ActionsControllerGetActionsParams } from "../../src/generated/api/yield";
import {
  fetchActivityFilterOptions,
  getActivityActionsQueryKey,
  getActivityActionsRequestParams,
} from "../../src/hooks/api/use-activity-actions";
import type { ActivityFilter } from "../../src/pages/details/activity-page/activity-filters";
import type { ApiClient } from "../../src/providers/api/api-client";

const address = "0x0000000000000000000000000000000000000001";
const network = "ethereum";

const sort = (values: ReadonlyArray<string>) => [...values].sort();

const yieldTypeKey = (values?: ReadonlyArray<string>) =>
  values ? sort(values).join("|") : "";

const filterByYieldTypes = new Map<string, ActivityFilter>([
  ["", "all"],
  [yieldTypeKey(["staking", "restaking", "liquid_staking"]), "stake"],
  [
    yieldTypeKey([
      "lending",
      "vault",
      "fixed_yield",
      "concentrated_liquidity_pool",
      "liquidity_pool",
    ]),
    "defi",
  ],
  [yieldTypeKey(["real_world_asset"]), "rwa"],
]);

const getFilterFromParams = (
  params: ActionsControllerGetActionsParams
): ActivityFilter => {
  const filter = filterByYieldTypes.get(yieldTypeKey(params.yieldTypes));

  if (!filter) {
    throw new Error(`Unexpected yieldTypes: ${params.yieldTypes?.join(",")}`);
  }

  return filter;
};

const createApiClient = (totals: Partial<Record<ActivityFilter, number>>) => {
  const calls: ActionsControllerGetActionsParams[] = [];
  const ActionsControllerGetActions = vi.fn(
    async ({ params }: { params: ActionsControllerGetActionsParams }) => {
      calls.push(params);

      return {
        items: [],
        limit: params.limit ?? 1,
        offset: params.offset ?? 0,
        total: totals[getFilterFromParams(params)] ?? 0,
      };
    }
  );
  const apiClient = {
    withOptions: vi.fn(() => ({
      yield: {
        ActionsControllerGetActions,
      },
    })),
  } as unknown as ApiClient;

  return { apiClient, calls };
};

describe("activity action request params", () => {
  it("omits yieldTypes for all activity", () => {
    const params = getActivityActionsRequestParams({
      address,
      filter: "all",
      limit: 50,
      network,
      offset: 0,
    });

    expect(params).not.toHaveProperty("yieldTypes");
    expect(params).toMatchObject({
      address,
      limit: 50,
      network,
      offset: 0,
      statuses: ["SUCCESS", "FAILED"],
    });
  });

  it.each([
    ["stake", ["staking", "restaking", "liquid_staking"]],
    [
      "defi",
      [
        "lending",
        "vault",
        "fixed_yield",
        "concentrated_liquidity_pool",
        "liquidity_pool",
      ],
    ],
    ["rwa", ["real_world_asset"]],
  ] as const satisfies ReadonlyArray<
    readonly [ActivityFilter, ReadonlyArray<string>]
  >)("adds %s yieldTypes to activity requests", (filter, yieldTypes) => {
    const params = getActivityActionsRequestParams({
      address,
      filter,
      limit: 50,
      network,
      offset: 0,
    });

    expect(sort(params.yieldTypes ?? [])).toEqual(sort(yieldTypes));
  });

  it("uses different query keys for each selected filter", () => {
    const allKey = getActivityActionsQueryKey({
      address,
      filter: "all",
      network,
    });
    const stakeKey = getActivityActionsQueryKey({
      address,
      filter: "stake",
      network,
    });

    expect(allKey).not.toEqual(stakeKey);
    expect(stakeKey[1]).toMatchObject({
      filter: "stake",
      yieldTypes: ["staking", "restaking", "liquid_staking"],
    });
  });
});

describe("fetchActivityFilterOptions", () => {
  it("returns exact all and non-zero category counts without borrow", async () => {
    const { apiClient, calls } = createApiClient({
      all: 7,
      stake: 2,
      defi: 0,
      rwa: 3,
    });

    const options = await fetchActivityFilterOptions({
      address,
      apiClient,
      network,
    });

    expect(options).toEqual([
      { filter: "all", count: 7 },
      { filter: "stake", count: 2 },
      { filter: "rwa", count: 3 },
    ]);
    expect(options.map((option) => option.filter)).not.toContain("borrow");

    expect(calls.map(getFilterFromParams)).toEqual([
      "all",
      "stake",
      "defi",
      "rwa",
    ]);
    expect(
      calls.every(
        (params) =>
          params.address === address &&
          params.network === network &&
          params.limit === 1 &&
          params.offset === 0 &&
          params.statuses?.join("|") === "SUCCESS|FAILED"
      )
    ).toBe(true);
  });
});
