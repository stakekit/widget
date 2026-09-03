import { DateTime, Duration } from "effect";
import { describe, expect, it } from "vitest";
import {
  getActivityDayKind,
  getActivityRelativeTime,
  getDisplayDurationUntil,
} from "../../src/shared/lib/date";

const utc = (value: string) => DateTime.makeUnsafe(value);

describe("date presentation helpers", () => {
  it("classifies local calendar days across a daylight-saving transition", () => {
    const now = utc("2026-03-08T07:30:00.000Z");
    const earlier = utc("2026-03-08T04:30:00.000Z");

    expect(
      getActivityDayKind(
        earlier,
        now,
        DateTime.zoneMakeNamedUnsafe("America/New_York")
      )
    ).toBe("yesterday");
    expect(
      getActivityDayKind(earlier, now, DateTime.zoneMakeNamedUnsafe("UTC"))
    ).toBe("today");
  });

  it.each([
    ["2026-07-23T11:59:01.000Z", { unit: "now" }],
    ["2026-07-23T11:58:00.000Z", { unit: "minutes", value: 2 }],
    ["2026-07-23T09:30:00.000Z", { unit: "hours", value: 2 }],
    ["2026-07-20T11:00:00.000Z", { unit: "days", value: 3 }],
  ] as const)("buckets compact relative time for %s", (date, expected) => {
    expect(
      getActivityRelativeTime(utc(date), utc("2026-07-23T12:00:00.000Z"))
    ).toEqual(expected);
  });

  it.each([
    [Duration.seconds(59), { unit: "less-than-minute" }],
    [Duration.minutes(1), { unit: "minutes", value: 1 }],
    [Duration.minutes(59), { unit: "minutes", value: 59 }],
    [Duration.hours(1), { unit: "hours", value: 1 }],
    [Duration.hours(23), { unit: "hours", value: 23 }],
    [Duration.days(1), { unit: "days", value: 1 }],
    [Duration.days(30), { unit: "days", value: 30 }],
    [Duration.days(31), { unit: "months", value: 1 }],
    [Duration.days(364), { unit: "months", value: 12 }],
    [Duration.days(365), { unit: "years", value: 1 }],
  ] as const)(
    "uses agreed display breakpoints for %o",
    (duration, expected) => {
      const now = utc("2026-01-01T00:00:00.000Z");

      expect(
        getDisplayDurationUntil(DateTime.addDuration(now, duration), now)
      ).toEqual(expected);
    }
  );
});
