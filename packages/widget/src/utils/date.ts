import {
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  differenceInSeconds,
  type FormatDurationOptions,
  formatDuration,
  intervalToDuration,
  isToday,
  isYesterday,
} from "date-fns";

const getFormat = ({
  days,
  hours,
  minutes,
}: {
  days: number;
  hours: number;
  minutes: number;
}): FormatDurationOptions["format"] => {
  if (days >= 1) {
    return ["days"];
  }
  if (hours >= 1) {
    return ["hours"];
  }
  if (minutes >= 1) {
    return ["minutes"];
  }
  return ["seconds"];
};

export const formatDurationUntilDate = (futureDate: Date) => {
  const {
    days = 0,
    hours = 0,
    minutes = 0,
    seconds = 0,
  } = intervalToDuration({ start: new Date(), end: futureDate });

  return formatDuration(
    { days, hours, minutes, seconds },
    { format: getFormat({ days, hours, minutes }) }
  );
};

export const dateOlderThen7Days = (date: string): boolean => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return new Date(date) < sevenDaysAgo;
};

type ActivityDayKind = "today" | "yesterday" | "other";

export const getActivityDayKind = (date: Date): ActivityDayKind =>
  isToday(date) ? "today" : isYesterday(date) ? "yesterday" : "other";

type ActivityRelativeTime =
  | { unit: "now" }
  | { unit: "minutes" | "hours" | "days"; value: number };

/**
 * Compact, unit-bucketed relative time used by the activity list (e.g. 2h, 3d).
 * The caller is responsible for localizing the resulting unit/value.
 */
export const getActivityRelativeTime = (
  date: Date,
  now: Date = new Date()
): ActivityRelativeTime => {
  const seconds = differenceInSeconds(now, date);
  if (seconds < 60) return { unit: "now" };

  const minutes = differenceInMinutes(now, date);
  if (minutes < 60) return { unit: "minutes", value: minutes };

  const hours = differenceInHours(now, date);
  if (hours < 24) return { unit: "hours", value: hours };

  return { unit: "days", value: Math.max(differenceInDays(now, date), 1) };
};
