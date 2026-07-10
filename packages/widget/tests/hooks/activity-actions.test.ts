import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { ActivityActionsPage } from "../../src/domain/schema/activity-models";
import {
  ActivityActionsKey,
  getActivityActionsRequestParams,
} from "../../src/hooks/api/activity-requests";
import type { ActivityFilter } from "../../src/pages/details/activity-page/activity-filters";
import { yieldApiActionFixture } from "../fixtures";

const address = Schema.decodeUnknownSync(
  Schema.NonEmptyString.pipe(Schema.brand("WalletAddress"))
)("0x0000000000000000000000000000000000000001");
const network = "ethereum" as const;

const sort = (values: ReadonlyArray<string>) => [...values].sort();

describe("activity action atom boundary", () => {
  it("builds completed and retryable activity request parameters", () => {
    expect(
      getActivityActionsRequestParams({
        address,
        filter: "all",
        limit: 50,
        network,
        offset: 0,
      })
    ).toMatchObject({
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
  >)("adds %s yield types", (filter, yieldTypes) => {
    const params = getActivityActionsRequestParams({
      address,
      filter,
      limit: 50,
      network,
      offset: 0,
    });

    expect(sort(params.yieldTypes ?? [])).toEqual(sort(yieldTypes));
  });

  it("constructs value-equal activity resource keys", () => {
    const fields = {
      address,
      enabled: true,
      filter: "stake" as const,
      network,
    };

    expect(new ActivityActionsKey(fields)).toEqual(
      new ActivityActionsKey({ ...fields })
    );
  });

  it("omits a malformed action while retaining valid siblings", async () => {
    const valid = yieldApiActionFixture({ id: "valid-action" });
    const malformed: Record<string, unknown> = {
      ...yieldApiActionFixture({ id: "invalid-action" }),
      transactions: [
        {
          ...yieldApiActionFixture().transactions[0]!,
          network: "not-a-network",
        },
      ],
    };
    const page = await Effect.runPromise(
      Schema.decodeUnknownEffect(ActivityActionsPage)({
        items: [valid, malformed],
        limit: 50,
        offset: 0,
        total: 2,
      })
    );

    expect(page.items?.map((item) => item.id)).toEqual(["valid-action"]);
    expect(page.total).toBe(2);
  });
});
