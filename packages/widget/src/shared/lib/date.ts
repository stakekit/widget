import { DateTime, Duration } from "effect";

type ActivityDayKind = "today" | "yesterday" | "other";

const isSameCalendarDay = (
  left: DateTime.DateTime,
  right: DateTime.DateTime
) => {
  const leftParts = DateTime.toParts(left);
  const rightParts = DateTime.toParts(right);

  return (
    leftParts.year === rightParts.year &&
    leftParts.month === rightParts.month &&
    leftParts.day === rightParts.day
  );
};

export const getActivityDayKind = (
  date: DateTime.Utc,
  now: DateTime.Utc,
  timeZone: DateTime.TimeZone
): ActivityDayKind => {
  const localDate = DateTime.setZone(date, timeZone);
  const localNow = DateTime.setZone(now, timeZone);
  const localYesterday = DateTime.subtract(localNow, { days: 1 });

  return isSameCalendarDay(localDate, localNow)
    ? "today"
    : isSameCalendarDay(localDate, localYesterday)
      ? "yesterday"
      : "other";
};

type ActivityRelativeTime =
  | { unit: "now" }
  | { unit: "minutes" | "hours" | "days"; value: number };

/**
 * Compact, unit-bucketed relative time used by the activity list (e.g. 2h, 3d).
 * The caller is responsible for localizing the resulting unit/value.
 */
export const getActivityRelativeTime = (
  date: DateTime.Utc,
  now: DateTime.Utc
): ActivityRelativeTime => {
  const elapsed = DateTime.distance(date, now);
  const seconds = Math.floor(Duration.toSeconds(elapsed));
  if (seconds < 60) return { unit: "now" };

  const minutes = Math.floor(Duration.toMinutes(elapsed));
  if (minutes < 60) return { unit: "minutes", value: minutes };

  const hours = Math.floor(Duration.toHours(elapsed));
  if (hours < 24) return { unit: "hours", value: hours };

  return {
    unit: "days",
    value: Math.max(Math.floor(Duration.toDays(elapsed)), 1),
  };
};

type DisplayDuration =
  | { readonly unit: "less-than-minute" }
  | {
      readonly unit: "minutes" | "hours" | "days" | "months" | "years";
      readonly value: number;
    };

const minute = Duration.minutes(1);
const hour = Duration.hours(1);
const day = Duration.days(1);
const monthBreakpoint = Duration.days(31);
const yearBreakpoint = Duration.days(365);

export const getDisplayDurationUntil = (
  future: DateTime.Utc,
  now: DateTime.Utc
): DisplayDuration | null => {
  if (DateTime.isLessThanOrEqualTo(future, now)) return null;

  const remaining = DateTime.distance(now, future);

  if (Duration.isLessThan(remaining, minute)) {
    return { unit: "less-than-minute" };
  }
  if (Duration.isLessThan(remaining, hour)) {
    return {
      unit: "minutes",
      value: Math.floor(Duration.toMinutes(remaining)),
    };
  }
  if (Duration.isLessThan(remaining, day)) {
    return {
      unit: "hours",
      value: Math.floor(Duration.toHours(remaining)),
    };
  }
  if (Duration.isLessThan(remaining, monthBreakpoint)) {
    return {
      unit: "days",
      value: Math.floor(Duration.toDays(remaining)),
    };
  }
  if (Duration.isLessThan(remaining, yearBreakpoint)) {
    return {
      unit: "months",
      value: Math.floor(Duration.toDays(remaining) / 30),
    };
  }
  return {
    unit: "years",
    value: Math.floor(Duration.toDays(remaining) / 365),
  };
};
