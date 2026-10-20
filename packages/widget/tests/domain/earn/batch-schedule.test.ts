import { DateTime } from "effect";
import { describe, expect, it } from "vitest";
import { getNextBatchCutoff } from "../../../src/domain/earn/batch-schedule";
import type { EarnInvestmentSchedule } from "../../../src/domain/earn/models";

type Path = EarnInvestmentSchedule["subscription"]["paths"][number];

const dailyPath = (overrides: Partial<Path> = {}): Path => ({
  cadence: "daily_cutoff",
  cutoffTime: "15:00",
  kind: "standard",
  status: "open",
  ...overrides,
});

const schedule = (path: Path, timezone = "UTC"): EarnInvestmentSchedule => ({
  redemption: { paths: [dailyPath({ cutoffTime: "11:00" })] },
  subscription: { paths: [path] },
  timezone,
});

const at = (iso: string) => DateTime.makeUnsafe(iso);
const cutoff = (value: EarnInvestmentSchedule, now: string) =>
  getNextBatchCutoff(value, "subscription", at(now))?.pipe(
    DateTime.formatIso
  ) ?? null;

describe("getNextBatchCutoff", () => {
  it("returns today's cutoff before it and tomorrow's from the cutoff on", () => {
    const value = schedule(dailyPath());

    expect(cutoff(value, "2026-10-19T11:48:00Z")).toBe(
      "2026-10-19T15:00:00.000Z"
    );
    expect(cutoff(value, "2026-10-19T15:00:00Z")).toBe(
      "2026-10-20T15:00:00.000Z"
    );
    expect(cutoff(value, "2026-10-19T17:04:00Z")).toBe(
      "2026-10-20T15:00:00.000Z"
    );
  });

  it("reads each side's own cutoff", () => {
    expect(
      getNextBatchCutoff(
        schedule(dailyPath()),
        "redemption",
        at("2026-10-19T12:00:00Z")
      )?.pipe(DateTime.formatIso)
    ).toBe("2026-10-20T11:00:00.000Z");
  });

  it("resolves the cutoff in the schedule's time zone", () => {
    // 16:00 in New York is 20:00 UTC during daylight saving time.
    expect(
      cutoff(
        schedule(dailyPath({ cutoffTime: "16:00" }), "America/New_York"),
        "2026-07-27T18:00:00Z"
      )
    ).toBe("2026-07-27T20:00:00.000Z");
  });

  it("skips weekends for business-day schedules", () => {
    // 2026-10-23 is a Friday.
    expect(
      cutoff(
        schedule(dailyPath({ businessDaysOnly: true })),
        "2026-10-23T16:00:00Z"
      )
    ).toBe("2026-10-26T15:00:00.000Z");
  });

  it("keeps the local cutoff time across a daylight saving change", () => {
    // 02:30 does not exist on 2026-03-08 in New York; the next day it does.
    expect(
      cutoff(
        schedule(dailyPath({ cutoffTime: "02:30" }), "America/New_York"),
        "2026-03-08T08:00:00Z"
      )
    ).toBe("2026-03-09T06:30:00.000Z");
  });

  it("prefers a published window that has not closed yet", () => {
    expect(
      cutoff(
        schedule(
          dailyPath({
            currentWindow: {
              closesAt: "2026-10-19T12:00:00Z",
              opensAt: "2026-10-18T12:00:00Z",
            },
            nextWindow: {
              closesAt: "2026-10-20T13:30:00Z",
              opensAt: "2026-10-19T12:00:00Z",
            },
          })
        ),
        "2026-10-19T12:30:00Z"
      )
    ).toBe("2026-10-20T13:30:00.000Z");
  });

  it("has no cutoff for closed, unscheduled, or malformed paths", () => {
    const now = "2026-10-19T12:00:00Z";

    expect(cutoff(schedule(dailyPath({ status: "closed" })), now)).toBeNull();
    expect(
      cutoff(schedule(dailyPath({ cadence: "continuous" })), now)
    ).toBeNull();
    expect(cutoff(schedule(dailyPath({ cutoffTime: "3pm" })), now)).toBeNull();
    expect(cutoff(schedule(dailyPath(), "Not/AZone"), now)).toBeNull();
  });
});
