import { DateTime, Array as EArray, Option } from "effect";
import type { EarnInvestmentSchedule } from "./models";

/** Deposits join the subscription batch; withdrawals the redemption batch. */
export type BatchSide = "subscription" | "redemption";

type SchedulePath = EarnInvestmentSchedule[BatchSide]["paths"][number];

const cutoffTimePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

// A week covers any weekend skip.
const searchDays = EArray.range(0, 7);

const isWeekend = (date: DateTime.DateTime) => {
  const weekDay = DateTime.toParts(date).weekDay;
  return weekDay === 0 || weekDay === 6;
};

const getPublishedCutoff = (path: SchedulePath, now: DateTime.Utc) =>
  [path.currentWindow, path.nextWindow]
    .flatMap((window) =>
      window ? Option.toArray(DateTime.make(window.closesAt)) : []
    )
    .map(DateTime.toUtc)
    .find((closesAt) => DateTime.isGreaterThan(closesAt, now)) ?? null;

const getDailyCutoff = (
  path: SchedulePath,
  timezone: string,
  now: DateTime.Utc
) => {
  const time = cutoffTimePattern.exec(path.cutoffTime ?? "");
  if (path.cadence !== "daily_cutoff" || !time) return null;

  return DateTime.setZoneNamed(now, timezone).pipe(
    Option.flatMap((zonedNow) => {
      // Set the time on each date: a DST shift on one day must not carry over.
      const cutoffOn = (offset: number) =>
        DateTime.setParts(DateTime.add(zonedNow, { days: offset }), {
          hour: Number(time[1]),
          millisecond: 0,
          minute: Number(time[2]),
          second: 0,
        });
      return EArray.findFirst(searchDays, (offset) => {
        const candidate = cutoffOn(offset);
        return (
          DateTime.isGreaterThan(candidate, now) &&
          !(path.businessDaysOnly && isWeekend(candidate))
        );
      }).pipe(Option.map((offset) => DateTime.toUtc(cutoffOn(offset))));
    }),
    Option.getOrNull
  );
};

const getBatchPath = (schedule: EarnInvestmentSchedule, side: BatchSide) => {
  const path = schedule[side].paths.find((item) => item.kind === "standard");
  return path && path.status !== "closed" ? path : null;
};

/**
 * When the next batch for `side` stops accepting orders, i.e. when an order
 * placed now is dispatched. Null when the schedule has no batch timing.
 */
export const getNextBatchCutoff = (
  schedule: EarnInvestmentSchedule,
  side: BatchSide,
  now: DateTime.Utc
): DateTime.Utc | null => {
  const path = getBatchPath(schedule, side);
  if (!path) return null;

  return (
    getPublishedCutoff(path, now) ??
    getDailyCutoff(path, schedule.timezone, now)
  );
};

/**
 * Whether the live `side` window has closed without its batch dispatching:
 * the batch may run any moment.
 */
export const isPublishedBatchDue = (
  schedule: EarnInvestmentSchedule,
  side: BatchSide,
  now: DateTime.Utc
): boolean => {
  const window = getBatchPath(schedule, side)?.currentWindow;
  if (!window) return false;
  return Option.match(DateTime.make(window.closesAt), {
    onNone: () => false,
    onSome: (closesAt) => !DateTime.isGreaterThan(closesAt, now),
  });
};

/** The next batch run from the live schedule window only. */
export const getPublishedBatchCutoff = (
  schedule: EarnInvestmentSchedule,
  side: BatchSide,
  now: DateTime.Utc
): DateTime.Utc | null => {
  const path = getBatchPath(schedule, side);
  return path ? getPublishedCutoff(path, now) : null;
};

/** The local cutoff time of a daily batch, e.g. 11:00 UTC; null otherwise. */
export const getDailyBatchCutoff = (
  schedule: EarnInvestmentSchedule,
  side: BatchSide
): Readonly<{ time: string; timezone: string }> | null => {
  const path = getBatchPath(schedule, side);
  return path?.cadence === "daily_cutoff" &&
    path.cutoffTime &&
    cutoffTimePattern.test(path.cutoffTime)
    ? { time: path.cutoffTime, timezone: schedule.timezone }
    : null;
};
