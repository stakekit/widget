import { type DateTime, Schema } from "effect";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { UtcDateTimeFromString } from "../../src/domain/finance/scalars";
import type { HistoryPoint } from "../../src/domain/portfolio/models";
import {
  ChartTooltip,
  HistoryChart,
} from "../../src/features/earn/ui/dashboard/earn-details/reward-rate-chart";
import { createWidgetI18nInstance } from "../../src/services/translation/widget-translation";
import { render } from "../utils/test-utils.dom.tsx";

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

describe("HistoryChart component", () => {
  it("renders empty state when data has fewer than 2 points", async () => {
    const { container, unmount } = await render(
      <I18nextProvider i18n={i18nInstance}>
        <HistoryChart
          chartId="reward-rate"
          data={[]}
          isLoading={false}
          isRefreshing={false}
          refreshKey="30d"
          tickFormatter={(val) => `${val}%`}
        />
      </I18nextProvider>
    );

    expect(container.textContent).toContain("No chart data");
    unmount();
  });

  it("renders chart surface with SVG when points are provided", async () => {
    const { container, unmount } = await render(
      <I18nextProvider i18n={i18nInstance}>
        <HistoryChart
          chartId="reward-rate"
          data={samplePoints}
          isLoading={false}
          isRefreshing={false}
          refreshKey="30d"
          tickFormatter={(val) => `${val.toFixed(2)}%`}
        />
      </I18nextProvider>
    );

    expect(container.querySelector("svg.recharts-surface")).toBeTruthy();
    expect(container.textContent).not.toContain("No chart data");
    unmount();
  });
});

describe("ChartTooltip component", () => {
  it("returns null when not active or payload is empty", async () => {
    const { container: c1, unmount: u1 } = await render(
      <ChartTooltip active={false} payload={[]} />
    );
    expect(c1.children.length).toBe(0);
    u1();

    const { container: c2, unmount: u2 } = await render(
      <ChartTooltip active={true} payload={[]} />
    );
    expect(c2.children.length).toBe(0);
    u2();
  });

  it("preserves the UTC snapshot date west of UTC", async () => {
    vi.stubEnv("TZ", "America/Los_Angeles");

    try {
      const point = samplePoints[1]!;
      const { container, unmount } = await render(
        <ChartTooltip
          active={true}
          chartId="reward-rate"
          formatValue={(val) => `${val.toFixed(2)}%`}
          locale="en"
          payload={[{ payload: point, value: point.value }]}
        />
      );

      const tooltip = container.querySelector(
        '[data-testid="reward-rate-tooltip"]'
      );
      expect(tooltip).toBeTruthy();
      expect(tooltip?.textContent).toContain("6.85%");
      expect(tooltip?.textContent).toContain("Jun 15, 2026");
      unmount();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("formats dates with French locale when specified", async () => {
    const point = samplePoints[1]!;
    const { container, unmount } = await render(
      <ChartTooltip
        active={true}
        chartId="reward-rate"
        formatValue={(val) => `${val.toFixed(2)}%`}
        locale="fr"
        payload={[{ payload: point, value: point.value }]}
      />
    );

    const tooltip = container.querySelector(
      '[data-testid="reward-rate-tooltip"]'
    );
    expect(tooltip?.textContent).toContain("6.85%");
    expect(tooltip?.textContent).toContain("15 juin 2026");
    unmount();
  });

  it("safely returns null if data point value is missing or non-finite", async () => {
    const invalidPoint = {
      timestamp: parseDate("2026-06-01T00:00:00.000Z"),
      value: Number.NaN,
    };
    const { container, unmount } = await render(
      <ChartTooltip
        active={true}
        payload={[{ payload: invalidPoint as never, value: Number.NaN }]}
      />
    );

    expect(container.children.length).toBe(0);
    unmount();
  });
});
