import { DateTime, Duration } from "effect";
import { describe, expect, it } from "vitest";
import {
  formatDateTime,
  formatTimeAxis,
  getActivityRelativeTime,
  getDisplayDurationUntil,
} from "../../../src/shared/lib/date";

const utc = (value: string) => DateTime.makeUnsafe(value);

describe("date presentation helpers", () => {
  it.each([
    ["UTC", "Jul 28, 2026, 23:30"],
    ["Pacific/Kiritimati", "Jul 29, 2026, 13:30"],
    ["America/New_York", "Jul 28, 2026, 19:30"],
  ] as const)("formats a timestamp in the %s time zone", (zone, expected) => {
    expect(
      formatDateTime(utc("2026-07-28T23:30:00.000Z"), {
        day: "numeric",
        hour: "2-digit",
        hour12: false,
        locale: "en-US",
        minute: "2-digit",
        month: "short",
        timeZone: DateTime.zoneMakeNamedUnsafe(zone),
        year: "numeric",
      })
    ).toBe(expected);
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

describe("formatTimeAxis", () => {
  const utcZone = DateTime.zoneMakeNamedUnsafe("UTC");
  const times = (...isoDates: ReadonlyArray<string>) =>
    isoDates.map((iso) => DateTime.toEpochMillis(DateTime.makeUnsafe(iso)));

  it("labels ticks by day within six months", () => {
    const ticks = times("2026-08-08", "2026-09-22", "2026-11-06");

    expect(formatTimeAxis(ticks, { locale: "en", timeZone: utcZone })).toEqual([
      "Aug 8",
      "Sep 22",
      "Nov 6",
    ]);
    expect(formatTimeAxis(ticks, { locale: "fr", timeZone: utcZone })).toEqual([
      "8 août",
      "22 sept.",
      "6 nov.",
    ]);
  });

  it("labels ticks by month and year beyond six months", () => {
    const ticks = times("2024-12-01", "2025-11-30", "2026-11-06");

    expect(formatTimeAxis(ticks, { locale: "en", timeZone: utcZone })).toEqual([
      "Dec '24",
      "Nov '25",
      "Nov '26",
    ]);
    expect(formatTimeAxis(ticks, { locale: "fr", timeZone: utcZone })).toEqual([
      "déc. 2024",
      "nov. 2025",
      "nov. 2026",
    ]);
  });

  it("reads each tick in the given zone", () => {
    const ticks = times("2026-08-08T00:00:00Z", "2026-11-06T00:00:00Z");
    const losAngeles = DateTime.zoneMakeNamedUnsafe("America/Los_Angeles");

    expect(
      formatTimeAxis(ticks, { locale: "en", timeZone: losAngeles })
    ).toEqual(["Aug 7", "Nov 5"]);
  });
});
