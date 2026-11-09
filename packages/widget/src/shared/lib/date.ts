import { DateTime, Duration } from "effect";

type DateTimeFormatOptions = Omit<Intl.DateTimeFormatOptions, "timeZone"> & {
  readonly locale: string;
  readonly timeZone: DateTime.TimeZone;
};

/**
 * The only display formatter for dates. The zone is required so a caller can
 * never fall back to the runtime's zone implicitly.
 */
export const formatDateTime = (
  value: DateTime.Utc,
  { timeZone, ...options }: DateTimeFormatOptions
) => DateTime.format(DateTime.setZone(value, timeZone), options);

export type ActivityRelativeTime =
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

/** Past this span a time axis labels its ticks by month and year. */
const yearBearingTimeAxisSpan = Duration.toMillis(Duration.days(183));

/**
 * Time-axis labels for epoch-millisecond ticks in `timeZone`: by day
 * ("Aug 8") within six months; beyond, by month and year ("Dec '24" in
 * English, the language's own "déc. 2024" otherwise), so a one-year axis does
 * not read "Nov 6" at both ends.
 */
export const formatTimeAxis = (
  times: ReadonlyArray<number>,
  {
    locale,
    timeZone,
  }: { readonly locale: string; readonly timeZone: DateTime.TimeZone }
): ReadonlyArray<string> => {
  const span = (times.at(-1) ?? 0) - (times[0] ?? 0);
  const yearBearing = span > yearBearingTimeAxisSpan;
  const english = new Intl.Locale(locale).language === "en";

  return times.map((time) => {
    const date = DateTime.makeUnsafe(time);
    if (!yearBearing) {
      return formatDateTime(date, {
        timeZone,
        locale,
        month: "short",
        day: "numeric",
      });
    }
    if (!english) {
      return formatDateTime(date, {
        timeZone,
        locale,
        month: "short",
        year: "numeric",
      });
    }
    const month = formatDateTime(date, { timeZone, locale, month: "short" });
    const year = formatDateTime(date, { timeZone, locale, year: "2-digit" });
    return `${month} '${year}`;
  });
};
