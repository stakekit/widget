import { DateTime } from "effect";
import { describe, expect, it } from "vitest";
import type { EarnInvestmentSchedule } from "../../../src/domain/earn/models";
import {
  formatDailyBatch,
  formatNextBatchTiming,
} from "../../../src/features/yield-summary/index";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import { confidentialYieldFixture, yieldApiYieldFixture } from "../../fixtures";

const t = createWidgetI18nInstance().getFixedT("en");

const now = DateTime.makeUnsafe("2026-10-19T12:00:00Z");

const schedule = (
  currentWindow: { closesAt: string; opensAt: string } | null
): EarnInvestmentSchedule => {
  const path = {
    cadence: "daily_cutoff",
    currentWindow,
    cutoffTime: "15:00",
    kind: "standard",
    status: "open",
  };
  return {
    redemption: { paths: [path] },
    subscription: { paths: [path] },
    timezone: "UTC",
  };
};

const confidential = (value: EarnInvestmentSchedule) => ({
  ...confidentialYieldFixture(),
  investmentSchedule: value,
});

// The backend keeps a live window past its close until the batch dispatches.
const pastWindow = {
  closesAt: "2026-10-19T11:00:00Z",
  opensAt: "2026-10-18T11:00:00Z",
};

describe("next batch timing", () => {
  it("times a confidential batch by its live window", () => {
    expect(
      formatNextBatchTiming({
        now,
        side: "subscription",
        t,
        yieldDto: confidential(
          schedule({
            closesAt: "2026-10-19T15:00:00Z",
            opensAt: "2026-10-19T00:00:00Z",
          })
        ),
      })
    ).toEqual({ _tag: "in", duration: "3 hours" });
  });

  it("marks a confidential batch due once its live window has closed", () => {
    const yieldDto = confidential(schedule(pastWindow));

    expect(
      formatNextBatchTiming({ now, side: "subscription", t, yieldDto })
    ).toEqual({ _tag: "due" });
    expect(formatDailyBatch({ side: "subscription", t, yieldDto })).toBeNull();
  });

  it("gives no confidential batch time without a live window", () => {
    expect(
      formatNextBatchTiming({
        now,
        side: "subscription",
        t,
        yieldDto: confidential(schedule(null)),
      })
    ).toBeNull();
  });

  it("still estimates other daily-cutoff yields from their cutoff", () => {
    const yieldDto = {
      ...yieldApiYieldFixture(),
      investmentSchedule: schedule(pastWindow),
    };

    expect(
      formatNextBatchTiming({ now, side: "subscription", t, yieldDto })
    ).toEqual({ _tag: "in", duration: "3 hours" });
    expect(
      formatDailyBatch({ side: "subscription", t, yieldDto })
    ).not.toBeNull();
  });
});
