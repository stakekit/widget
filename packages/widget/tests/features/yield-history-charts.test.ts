import { DateTime, Effect, Layer, Schema } from "effect";
import { Atom, AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { exactDecimal } from "../../src/domain/finance/exact";
import { UtcDateTimeFromString } from "../../src/domain/finance/scalars";
import type { HistoryPeriod } from "../../src/domain/portfolio/models";
import { earnRewardRateHistoryChart } from "../../src/features/earn/state/yield-history-charts";
import { YieldResourceSource } from "../../src/services/api/resource-sources";
import { yieldApiYieldFixture } from "../fixtures";

const yieldId = yieldApiYieldFixture().id;
const start = Schema.decodeSync(UtcDateTimeFromString)(
  "2026-06-01T00:00:00.000Z"
);

const makeItems = (rates: ReadonlyArray<string>) =>
  rates.map((rate, index) => ({
    rewardRate: exactDecimal(rate),
    timestamp: DateTime.add(start, { days: index }),
  }));

const makeRegistry = (
  getRewardRateHistory: (key: {
    readonly period: HistoryPeriod;
  }) => Effect.Effect<unknown>
) =>
  AtomRegistry.make({
    initialValues: [
      Atom.initialValue(
        appRuntime.layer,
        Layer.succeed(
          YieldResourceSource,
          YieldResourceSource.of({ getRewardRateHistory } as never)
        )
      ),
    ],
  });

describe("Earn history chart ranges", () => {
  it("keeps the displayed points while another range loads", async () => {
    const registry = makeRegistry((key) =>
      key.period === "90d"
        ? Effect.succeed({ items: makeItems(["0.04", "0.05"]) })
        : Effect.never
    );
    const view = earnRewardRateHistoryChart.viewAtom(yieldId);
    const unmount = registry.mount(view);

    await vi.waitFor(() => expect(registry.get(view).points).toHaveLength(2));

    registry.set(earnRewardRateHistoryChart.selectPeriodAtom, "1y");

    await vi.waitFor(() =>
      expect(registry.get(view)).toMatchObject({
        isLoading: false,
        isRefreshing: true,
        period: "1y",
      })
    );
    expect(registry.get(view).points).toHaveLength(2);

    unmount();
  });

  it("stays renderable when another range has too few points", async () => {
    const registry = makeRegistry((key) =>
      Effect.succeed({
        items: key.period === "90d" ? makeItems(["0.04", "0.05"]) : [],
      })
    );
    const view = earnRewardRateHistoryChart.viewAtom(yieldId);
    const unmount = registry.mount(view);

    await vi.waitFor(() => expect(registry.get(view).points).toHaveLength(2));

    registry.set(earnRewardRateHistoryChart.selectPeriodAtom, "30d");

    await vi.waitFor(() =>
      expect(registry.get(view)).toMatchObject({ period: "30d", points: [] })
    );
    expect(registry.get(view).canRender).toBe(true);

    unmount();
  });

  it("reports loading before any range has points", async () => {
    const registry = makeRegistry(() => Effect.never);
    const view = earnRewardRateHistoryChart.viewAtom(yieldId);
    const unmount = registry.mount(view);

    await vi.waitFor(() =>
      expect(registry.get(view)).toMatchObject({
        isLoading: true,
        isRefreshing: false,
        points: [],
      })
    );

    unmount();
  });
});
