import { type DateTime, Schema } from "effect";
import type { ComponentProps } from "react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";

import { exactDecimal } from "../../../src/domain/finance/exact";
import { UtcDateTimeFromString } from "../../../src/domain/finance/scalars";
import type { HistoryPoint } from "../../../src/domain/portfolio/models";
import { getRewardRateHistoryChart } from "../../../src/features/earn/model/history-chart";
import { HistoryChartSection } from "../../../src/features/earn/ui/dashboard/earn-details/components/history-chart-section";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";

const i18nInstance = createWidgetI18nInstance();

const parseDate = (iso: string): DateTime.Utc =>
  Schema.decodeSync(UtcDateTimeFromString)(iso);

const samplePoints: ReadonlyArray<HistoryPoint> = [
  { timestamp: parseDate("2026-06-02T00:00:00.000Z"), value: 6.5 },
  { timestamp: parseDate("2026-06-15T00:00:00.000Z"), value: 6.85 },
  { timestamp: parseDate("2026-07-01T00:00:00.000Z"), value: 7.19 },
];

const view = (
  overrides: Partial<ComponentProps<typeof HistoryChartSection>["view"]> = {}
): ComponentProps<typeof HistoryChartSection>["view"] => ({
  canRender: true,
  isLoading: false,
  isRefreshing: false,
  period: "30d",
  points: samplePoints,
  pointsPeriod: "30d",
  ...overrides,
});

const renderSection = ({
  locale = "en",
  onPeriodChange = vi.fn(),
  points = samplePoints,
}: {
  readonly locale?: string;
  readonly onPeriodChange?: ComponentProps<
    typeof HistoryChartSection
  >["onPeriodChange"];
  readonly points?: ReadonlyArray<HistoryPoint>;
} = {}) =>
  render(
    <I18nextProvider i18n={i18nInstance}>
      <div style={{ width: 400 }}>
        <HistoryChartSection
          chart={getRewardRateHistoryChart({
            locale,
            now: parseDate("2026-07-01T12:00:00.000Z"),
            period: "30d",
            points,
            rate: {
              label: "APY",
              rateType: "APY",
              value: "7.10%",
              ratio: exactDecimal("0.071"),
            },
            t: i18nInstance.getFixedT(locale),
          })}
          onPeriodChange={onPeriodChange}
          view={view({ points })}
        />
      </div>
    </I18nextProvider>
  );

describe("HistoryChartSection", () => {
  it("names the chart and says when there is nothing to draw", async () => {
    const screen = await renderSection({ points: [] });

    await expect
      .element(screen.getByRole("figure", { name: "APY history" }))
      .toHaveTextContent("No chart data");
  });

  it("labels the value axis in round ticks of one precision", async () => {
    const screen = await renderSection();
    const chart = screen.getByRole("img", { name: "APY history" });

    for (const tick of ["6.4%", "6.6%", "6.8%", "7.0%", "7.2%"]) {
      await expect
        .element(chart.getByText(tick, { exact: true }))
        .toBeVisible();
    }
  });

  it("titles the chart with the latest rate", async () => {
    const screen = await renderSection();

    await expect
      .element(screen.getByText("APY 7.19%", { exact: true }))
      .toBeVisible();
  });

  it("shows the hovered point's value and date", async () => {
    const screen = await renderSection();
    const chart = screen.getByRole("img", { name: "APY history" });
    const surface = chart.element().querySelector("svg.recharts-surface");
    expect(surface).toBeTruthy();
    if (!surface) return;

    const box = surface.getBoundingClientRect();
    await userEvent.hover(surface, {
      position: { x: box.width / 2, y: box.height / 2 },
    });

    await expect.element(chart.getByText("6.85%").first()).toBeVisible();
    await expect.element(chart.getByText("Jun 15, 2026")).toBeVisible();
  });

  it("formats dates in the chart's locale", async () => {
    const screen = await renderSection({ locale: "fr" });
    const chart = screen.getByRole("img", { name: /APY/ });
    const surface = chart.element().querySelector("svg.recharts-surface");
    if (!surface) throw new Error("chart surface missing");

    const box = surface.getBoundingClientRect();
    await userEvent.hover(surface, {
      position: { x: box.width / 2, y: box.height / 2 },
    });

    await expect.element(chart.getByText("15 juin 2026")).toBeVisible();
  });

  it("picks a period from the segmented control", async () => {
    const onPeriodChange = vi.fn();
    const screen = await renderSection({ onPeriodChange });

    await expect
      .element(screen.getByRole("button", { name: "1M" }))
      .toHaveAttribute("aria-pressed", "true");

    await userEvent.click(screen.getByRole("button", { name: "1Y" }));

    expect(onPeriodChange).toHaveBeenCalledWith("1y");
  });
});
