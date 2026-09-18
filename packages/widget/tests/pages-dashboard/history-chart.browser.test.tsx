import { type DateTime, Schema } from "effect";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { UtcDateTimeFromString } from "../../src/domain/finance/scalars";
import type { HistoryPoint } from "../../src/domain/portfolio/models";
import { HistoryChart } from "../../src/features/earn/ui/dashboard/earn-details/reward-rate-chart";
import { createWidgetI18nInstance } from "../../src/services/translation/widget-translation";

const i18nInstance = createWidgetI18nInstance();

const parseDate = (iso: string): DateTime.Utc =>
  Schema.decodeSync(UtcDateTimeFromString)(iso);

const samplePoints: ReadonlyArray<HistoryPoint> = [
  {
    timestamp: parseDate("2026-06-01T00:00:00.000Z"),
    value: 6.5,
  },
  {
    timestamp: parseDate("2026-06-15T00:00:00.000Z"),
    value: 6.85,
  },
  {
    timestamp: parseDate("2026-07-01T00:00:00.000Z"),
    value: 7.19,
  },
];

describe("HistoryChart browser interactions", () => {
  it("displays hover container with point details and active dot on mouse move", async () => {
    const screen = await render(
      <I18nextProvider i18n={i18nInstance}>
        <div style={{ width: 400, height: 200 }}>
          <HistoryChart
            chartId="reward-rate"
            data={samplePoints}
            isLoading={false}
            isRefreshing={false}
            refreshKey="30d"
            tickFormatter={(val) => `${val.toFixed(2)}%`}
          />
        </div>
      </I18nextProvider>
    );

    const surface = screen.container.querySelector("svg.recharts-surface");
    expect(surface).toBeTruthy();

    if (!surface) return;
    // Hover over the chart surface
    await userEvent.hover(surface);
    const tooltip = screen.getByTestId("reward-rate-tooltip");
    await expect.element(tooltip).toBeVisible();
    await expect.element(tooltip.getByText("6.85%")).toBeVisible();
    await expect.element(tooltip.getByText("Jun 15, 2026")).toBeVisible();

    const activeDot = screen.container.querySelector(
      'g[key*="reward-rate-active-dot"], circle[r="3.5"]'
    );
    expect(activeDot).toBeTruthy();
  });
});
