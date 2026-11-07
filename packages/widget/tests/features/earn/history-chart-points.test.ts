import { DateTime, Schema } from "effect";
import { describe, expect, it } from "vitest";

import { ActionCommand } from "../../../src/domain/action/models";
import { exactDecimal } from "../../../src/domain/finance/exact";
import { UtcDateTimeFromString } from "../../../src/domain/finance/scalars";
import {
  WalletAddress,
  YieldId,
} from "../../../src/domain/identity/identifiers";
import {
  getRewardRateHistoryChart,
  getTvlHistoryChart,
} from "../../../src/features/earn/model/history-chart";
import {
  toRewardRateHistoryChartPoint,
  toTvlHistoryChartPoint,
} from "../../../src/features/earn/model/history-chart-points";
import { toHistoryPoints } from "../../../src/features/earn/model/yield-history-series";
import { getYieldFigures } from "../../../src/features/yield-summary/model/yield-figures";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import { yieldApiYieldFixture } from "../../fixtures";

const t = createWidgetI18nInstance().getFixedT("en");

const timestamp = Schema.decodeSync(UtcDateTimeFromString)(
  "2026-06-01T00:00:00.000Z"
);

describe("history chart adapters", () => {
  it("converts exact history values to numbers only for chart points", () => {
    const tvl = exactDecimal("9007199254740993.25");
    const rewardRate = exactDecimal("0.0312");
    const tvlPoint = toTvlHistoryChartPoint({
      timestamp,
      tvl,
    });
    const rewardPoint = toRewardRateHistoryChartPoint({
      timestamp,
      rewardRate,
    });
    const command = Schema.decodeSync(ActionCommand)({
      address: Schema.decodeSync(WalletAddress)(
        "0x1234567890123456789012345678901234567890"
      ),
      arguments: { amount: tvl.toFixed() },
      yieldId: Schema.decodeSync(YieldId)("ethereum-eth-native-staking"),
    });

    expect(typeof tvlPoint.value).toBe("number");
    expect(DateTime.isDateTime(tvlPoint.timestamp)).toBe(true);
    expect(rewardPoint.value).toBe(3.12);
    expect(command.arguments?.amount).toBe(tvl.toFixed());
    expect(command.arguments?.amount).not.toBe(String(tvlPoint.value));
  });
});

describe("TVL history chart", () => {
  const parse = Schema.decodeSync(UtcDateTimeFromString);
  const vault = yieldApiYieldFixture({
    statistics: { tvl: "883.2912", tvlUsd: "1980000" },
  });
  const yieldDto = {
    ...vault,
    mechanics: { ...vault.mechanics, type: "vault" as const },
  };
  const points = toHistoryPoints(
    [
      {
        timestamp: parse("2026-11-05T00:00:00.000Z"),
        tvl: exactDecimal("883.2912"),
      },
      {
        timestamp: parse("2026-08-09T00:00:00.000Z"),
        tvl: exactDecimal("1500.5"),
      },
      {
        timestamp: parse("2026-09-22T00:00:00.000Z"),
        tvl: exactDecimal("1012.75"),
      },
    ],
    toTvlHistoryChartPoint
  );
  const now = parse("2026-11-06T12:00:00.000Z");
  const figures = getYieldFigures({ locale: "en", t, yieldDto });
  const chart = getTvlHistoryChart({
    locale: "en",
    now,
    period: "90d",
    points,
    symbol: yieldDto.token.symbol,
    t,
    tvl: figures.tvl,
  });

  it("plots TVL in the yield's token units, on a token axis", () => {
    expect(chart.data.map((point) => point.value)).toEqual([
      1500.5, 1012.75, 883.2912,
    ]);
    expect(chart.valueAxis.ticks).toEqual([800, 1000, 1200, 1400, 1600]);
    expect(chart.valueAxis.labels).toEqual([
      "800",
      "1.0K",
      "1.2K",
      "1.4K",
      "1.6K",
    ]);
    expect(chart.formatValue(1012.75)).toBe("1,012.75 ETH");
  });

  it("heads the chart with the USD TVL and the token amount beneath", () => {
    expect(chart.title).toBe("TVL");
    expect(chart.figure).toBe("$1.98M");
    expect(chart.secondary).toBe("≈ 883.29 ETH");
    expect(figures.tvl).toEqual({ usd: "$1.98M", token: "≈ 883.29 ETH" });
  });

  it("labels the latest point as the header's token figure reads", () => {
    expect(chart.latestLabel).toBe("883.29 ETH");
    expect(chart.secondary).toBe(`≈ ${chart.latestLabel}`);
  });

  it("spans the selected range, even where the series starts later", () => {
    const late = getTvlHistoryChart({
      locale: "en",
      now,
      period: "90d",
      points: points.slice(1),
      symbol: "ETH",
      t,
      tvl: figures.tvl,
    });
    const [start, , end] = late.timeAxis.ticks;

    expect(end).toBe(DateTime.toEpochMillis(now));
    expect(start).toBe(
      DateTime.toEpochMillis(DateTime.makeUnsafe("2026-08-08T12:00:00.000Z"))
    );
    expect(late.timeAxis.labels).toEqual(["Aug 8", "Sep 22", "Nov 6"]);
    expect(late.caption).toBeNull();
  });

  it("starts the axis exactly the range before now, leaving older points out", () => {
    const month = getTvlHistoryChart({
      locale: "en",
      now,
      period: "30d",
      points,
      symbol: "ETH",
      t,
      tvl: figures.tvl,
    });
    const [start, , end] = month.timeAxis.ticks;

    expect(end).toBe(DateTime.toEpochMillis(now));
    expect(start).toBe(
      DateTime.toEpochMillis(DateTime.makeUnsafe("2026-10-07T12:00:00.000Z"))
    );
    expect(month.data.map((point) => point.value)).toEqual([883.2912]);
    expect(month.valueAxis.ticks.every((tick) => tick < 1000)).toBe(true);
  });

  it("says when the series ends before the range does", () => {
    const stale = getTvlHistoryChart({
      locale: "en",
      now,
      period: "90d",
      points: points.slice(0, 2),
      symbol: "ETH",
      t,
      tvl: figures.tvl,
    });

    expect(stale.caption).toBe("Data to Sep 22");
    expect(stale.latestLabel).toBe("1,012.75 ETH");
  });
});

describe("Reward rate history chart", () => {
  const parse = Schema.decodeSync(UtcDateTimeFromString);
  const points = toHistoryPoints(
    [
      {
        timestamp: parse("2026-10-20T00:00:00.000Z"),
        rewardRate: exactDecimal("0.0158"),
      },
      {
        timestamp: parse("2026-11-05T00:00:00.000Z"),
        rewardRate: exactDecimal("0.017"),
      },
    ],
    toRewardRateHistoryChartPoint
  );
  const input = {
    locale: "en",
    now: parse("2026-11-06T12:00:00.000Z"),
    period: "30d",
    points,
    t,
  } as const;

  it("titles the chart with the yield's rate type and the latest rate", () => {
    const chart = getRewardRateHistoryChart({
      ...input,
      rate: { label: "APR", value: "1.60%", ratio: exactDecimal("0.016") },
    });

    expect(chart.title).toBe("APR");
    expect(chart.figure).toBe("1.70%");
    expect(chart.latestLabel).toBe("1.70%");
  });

  it("titles the chart with the yield's rate before any point loads", () => {
    const chart = getRewardRateHistoryChart({
      ...input,
      points: [],
      rate: { label: "APY", value: "1.60%", ratio: exactDecimal("0.016") },
    });

    expect(chart.title).toBe("APY");
    expect(chart.figure).toBe("1.60%");
  });

  it("reads as a reward rate when the yield has none to quote", () => {
    const chart = getRewardRateHistoryChart({ ...input, rate: null });

    expect(chart.title).toBe("Reward rate");
  });
});
