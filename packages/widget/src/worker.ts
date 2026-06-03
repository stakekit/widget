import { HttpResponse, http } from "msw";
import { setupWorker } from "msw/browser";
import { config } from "./config";

const getApiRoute = (baseUrl: string, path: string) =>
  new URL(path.startsWith("/") ? path : `/${path}`, baseUrl).toString();
const yieldApiRoute = (path: string) =>
  getApiRoute(config.env.yieldsApiUrl, path);

const rewardRateHistory = Array.from({ length: 90 }, (_, index) => {
  const date = new Date("2026-03-04T00:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + index);

  const wave = Math.sin(index / 5) * 0.0025;
  const drift = index > 45 ? (index - 45) * -0.00005 : index * 0.000015;
  const rebound = index > 78 ? (index - 78) * 0.00045 : 0;
  const rewardRate = Math.max(0.0481, 0.0525 + wave + drift + rebound);

  return {
    timestamp: date.toISOString(),
    rewardRate: rewardRate.toFixed(6),
  };
});

const tvlHistory = Array.from({ length: 90 }, (_, index) => {
  const date = new Date("2026-03-04T00:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + index);

  const wave = Math.sin(index / 6) * 280_000;
  const drift = index * 34_000;
  const tvlUsd = Math.max(8_500_000, 12_000_000 + wave + drift);

  return {
    timestamp: date.toISOString(),
    tvlUsd: tvlUsd.toFixed(2),
  };
});

const getHistoryItemsForPeriod = <T>(items: T[], period: string | null) =>
  period === "30d"
    ? items.slice(-30)
    : period === "1y" || period === "all"
      ? items
      : items.slice(-90);

export const worker = setupWorker(
  http.get(
    yieldApiRoute("/v1/yields/:yieldId/reward-rate/history"),
    async ({ params, request }) => {
      const url = new URL(request.url);
      const period = url.searchParams.get("period");
      const items = getHistoryItemsForPeriod(rewardRateHistory, period);

      return HttpResponse.json({
        yieldId: String(params.yieldId),
        total: items.length,
        offset: 0,
        limit: items.length,
        interval: "day",
        from: items[0]?.timestamp,
        to: items.at(-1)?.timestamp,
        items,
      });
    }
  ),
  http.get(
    yieldApiRoute("/v1/yields/:yieldId/tvl/history"),
    async ({ params, request }) => {
      const url = new URL(request.url);
      const period = url.searchParams.get("period");
      const items = getHistoryItemsForPeriod(tvlHistory, period);

      return HttpResponse.json({
        yieldId: String(params.yieldId),
        total: items.length,
        offset: 0,
        limit: items.length,
        interval: "day",
        from: items[0]?.timestamp,
        to: items.at(-1)?.timestamp,
        items,
      });
    }
  )
);
