import { Effect, Layer, Option, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { EarnPosition } from "../../src/domain/earn/models";
import { getDashboardYieldCategory } from "../../src/domain/earn/yield";
import { toPositionsData } from "../../src/domain/portfolio/positions";
import {
  currentGroupedPositionsAtom,
  positionsTableDataAtom,
  toPositionItems,
} from "../../src/features/portfolio/state/read-models/positions";
import {
  allPositionsSummaryAtom,
  getPositionsAverageApy,
  getPositionsTotal,
} from "../../src/features/portfolio/state/read-models/summary";
import {
  MultiYieldsKey,
  multiYieldsByIdAtom,
} from "../../src/features/yield-summary/state/multi-yields";
import { YieldResourceSource } from "../../src/services/api/resource-sources";
import {
  yieldApiProviderFixture,
  yieldApiYieldFixture,
  yieldBalanceFixture,
} from "../fixtures";
import { applicationRuntimeInitInitialValue } from "../utils/widget-config";

const makePosition = ({
  amountUsd,
  rewardRate,
  yieldId,
}: {
  readonly amountUsd: string;
  readonly rewardRate: number;
  readonly yieldId: string;
}) => {
  const yieldDto = yieldApiYieldFixture({
    id: yieldId,
    rewardRate: { components: [], rateType: "APY", total: rewardRate },
  });
  const position = Schema.decodeUnknownSync(EarnPosition)({
    balances: [
      yieldBalanceFixture({
        amount: "1",
        amountUsd,
        token: yieldDto.token,
      }),
    ],
    outputTokenBalance: null,
    yieldId: yieldDto.id,
  });
  const item = toPositionItems(toPositionsData([position]), false)[0]!;

  return { item, yieldDto };
};

describe("summary atom derivations", () => {
  it("recomputes position total and weighted APY when source state changes", () => {
    const first = makePosition({
      amountUsd: "5",
      rewardRate: 0.05,
      yieldId: "yield-1",
    });
    const second = makePosition({
      amountUsd: "15",
      rewardRate: 0.1,
      yieldId: "yield-2",
    });
    const yields = new Map([
      [first.yieldDto.id, first.yieldDto],
      [second.yieldDto.id, second.yieldDto],
    ]);
    const positionsAtom = Atom.make([first.item]);
    const totalAtom = Atom.make((get) =>
      getPositionsTotal(get(positionsAtom), yields)
    );
    const averageApyAtom = Atom.make((get) =>
      getPositionsAverageApy(get(positionsAtom), yields)
    );
    const registry = AtomRegistry.make();

    expect(registry.get(totalAtom).toFixed()).toBe("5");
    expect(registry.get(averageApyAtom).toFixed()).toBe("5");

    registry.set(positionsAtom, [first.item, second.item]);

    expect(registry.get(totalAtom).toFixed()).toBe("20");
    expect(registry.get(averageApyAtom).toFixed()).toBe("8.75");
  });

  it("retains a non-enterable Yield referenced by a historical position", () => {
    const historicalYield = yieldApiYieldFixture({
      status: { enter: false, exit: true },
    });
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          appRuntime.layer,
          Layer.succeed(YieldResourceSource, {
            getProvider: () =>
              Effect.succeed(Option.some(yieldApiProviderFixture())),
            listYields: () =>
              Effect.succeed({
                items: [historicalYield],
                limit: 100,
                offset: 0,
                total: 1,
              }),
          } as never)
        ),
      ],
    });

    const key = new MultiYieldsKey({ yieldIds: [historicalYield.id] });
    const result = registry.get(multiYieldsByIdAtom(key));
    const yields = AsyncResult.getOrThrow(result);
    const historicalPosition = makePosition({
      amountUsd: "5",
      rewardRate: historicalYield.rewardRate.total,
      yieldId: historicalYield.id,
    });

    expect(yields.has(historicalYield.id)).toBe(true);
    expect(getPositionsTotal([historicalPosition.item], yields).toFixed()).toBe(
      "5"
    );
  });

  it("publishes Portfolio summaries as AsyncResult without dropping failures", () => {
    const position = makePosition({
      amountUsd: "5",
      rewardRate: 0.05,
      yieldId: "yield-1",
    });
    const key = new MultiYieldsKey({ yieldIds: [position.yieldDto.id] });
    const successfulRegistry = AtomRegistry.make({
      initialValues: [
        applicationRuntimeInitInitialValue(),
        [positionsTableDataAtom, AsyncResult.success([position.item])],
        [
          multiYieldsByIdAtom(key),
          AsyncResult.success(
            new Map([[position.yieldDto.id, position.yieldDto]])
          ),
        ],
      ],
    });

    expect(
      AsyncResult.getOrThrow(
        successfulRegistry.get(allPositionsSummaryAtom)
      ).allPositionsSum.toFixed()
    ).toBe("5");

    const failure = new Error("Yield summary unavailable");
    const failedRegistry = AtomRegistry.make({
      initialValues: [
        applicationRuntimeInitInitialValue(),
        [positionsTableDataAtom, AsyncResult.success([position.item])],
        [multiYieldsByIdAtom(key), AsyncResult.fail(failure)],
      ],
    });
    const failed = failedRegistry.get(allPositionsSummaryAtom);

    expect(AsyncResult.isFailure(failed)).toBe(true);
    expect(AsyncResult.error(failed)).toEqual(Option.some(failure));

    successfulRegistry.dispose();
    failedRegistry.dispose();
  });

  it("publishes category-grouped position rows from the Portfolio atom", async () => {
    const position = makePosition({
      amountUsd: "5",
      rewardRate: 0.05,
      yieldId: "yield-1",
    });
    const category = getDashboardYieldCategory(position.yieldDto);
    if (!category) throw new Error("expected a dashboard Yield category");
    const listYields = vi.fn(() =>
      Effect.succeed({
        items: [position.yieldDto],
        limit: 100,
        offset: 0,
        total: 1,
      })
    );
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          appRuntime.layer,
          Layer.succeed(YieldResourceSource, {
            listYields,
          } as never)
        ),
        applicationRuntimeInitInitialValue({
          apiKey: "test-key",
          baseUrl: "https://api.example.com",
          dashboardVariant: true,
          variant: "default",
          yieldGrouping: "category",
          yieldsApiUrl: "https://yield.example.com",
        }),
        [positionsTableDataAtom, AsyncResult.success([position.item])],
      ],
    });
    const resource = currentGroupedPositionsAtom;
    const unmount = registry.mount(resource);

    await vi.waitFor(() =>
      expect(registry.get(resource)).toEqual([
        { kind: "chain-modal" },
        { category, count: 1, kind: "section" },
        {
          item: { kind: "earn", position: position.item },
          kind: "position",
        },
      ])
    );
    expect(listYields).toHaveBeenCalledOnce();

    unmount();
    registry.dispose();
  });
});
