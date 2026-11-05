import { type DateTime, Schema } from "effect";
import type { ComponentProps, ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { exactDecimal } from "../../../src/domain/finance/exact";
import { UtcDateTimeFromString } from "../../../src/domain/finance/scalars";
import type { HistoryPoint } from "../../../src/domain/portfolio/models";
import { HistoryChartSection } from "../../../src/features/earn/ui/dashboard/earn-details/components/history-chart-section";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import {
  formatPercent,
  formatPercentAxis,
} from "../../../src/shared/lib/number-format";
import {
  useWidgetPresentation,
  WidgetPresentationProvider,
} from "../../../src/shared/react/widget-presentation";

const i18nInstance = createWidgetI18nInstance();

const parseDate = (iso: string): DateTime.Utc =>
  Schema.decodeSync(UtcDateTimeFromString)(iso);

const samplePoints: ReadonlyArray<HistoryPoint> = [
  { timestamp: parseDate("2026-06-01T00:00:00.000Z"), value: 6.5 },
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
  ...overrides,
});

const Presentation = ({
  children,
  locale,
}: {
  readonly children: ReactNode;
  readonly locale: string;
}) => (
  <WidgetPresentationProvider value={{ ...useWidgetPresentation(), locale }}>
    {children}
  </WidgetPresentationProvider>
);

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
      <Presentation locale={locale}>
        <div style={{ width: 400 }}>
          <HistoryChartSection
            formatValue={(value) =>
              formatPercent(exactDecimal(value).div(100), locale)
            }
            formatValueAxis={(ticks) =>
              formatPercentAxis(
                ticks.map((tick) => exactDecimal(tick).div(100)),
                locale
              )
            }
            onPeriodChange={onPeriodChange}
            title="Reward rate"
            value="7.19%"
            view={view({ points })}
          />
        </div>
      </Presentation>
    </I18nextProvider>
  );

describe("HistoryChartSection", () => {
  it("names the chart and says when there is nothing to draw", async () => {
    const screen = await renderSection({ points: [] });

    await expect
      .element(screen.getByRole("figure", { name: "Reward rate history" }))
      .toHaveTextContent("No chart data");
  });

  it("labels the value axis in one precision", async () => {
    const screen = await renderSection();
    const chart = screen.getByRole("img", { name: "Reward rate history" });

    for (const tick of ["6.1%", "6.8%", "7.5%"]) {
      await expect
        .element(chart.getByText(tick, { exact: true }))
        .toBeVisible();
    }
  });

  it("shows the hovered point's value and its UTC date", async () => {
    vi.stubEnv("TZ", "America/Los_Angeles");

    try {
      const screen = await renderSection();
      const chart = screen.getByRole("img", { name: "Reward rate history" });
      const surface = chart.element().querySelector("svg.recharts-surface");
      expect(surface).toBeTruthy();
      if (!surface) return;

      const box = surface.getBoundingClientRect();
      await userEvent.hover(surface, {
        position: { x: box.width / 2, y: box.height / 2 },
      });

      await expect.element(chart.getByText("6.85%").first()).toBeVisible();
      await expect.element(chart.getByText("Jun 15, 2026")).toBeVisible();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("formats dates in the presentation locale", async () => {
    const screen = await renderSection({ locale: "fr" });
    const chart = screen.getByRole("img", { name: "Reward rate history" });
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
