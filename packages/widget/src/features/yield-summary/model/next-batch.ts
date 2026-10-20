import type { DateTime } from "effect";
import type { TFunction } from "i18next";
import {
  type BatchSide,
  getDailyBatchCutoff,
  getNextBatchCutoff,
} from "../../../domain/earn/batch-schedule";
import type { EarnYieldWithProvider } from "../../../domain/earn/models";
import { getDisplayDurationUntil } from "../../../shared/lib/date";

/** Localized time left until `future`, e.g. "3 hours"; null once passed. */
export const formatDurationUntil = (
  future: DateTime.Utc,
  now: DateTime.Utc,
  t: TFunction
): string | null => {
  const duration = getDisplayDurationUntil(future, now);
  if (!duration) return null;
  return duration.unit === "less-than-minute"
    ? t("position_details.duration.less_than_minute")
    : t(`position_details.duration.${duration.unit}`, {
        count: duration.value,
      });
};

/** Time left until the yield's next `side` batch, e.g. "3 hours". */
export const formatNextBatchIn = ({
  now,
  side,
  t,
  yieldDto,
}: {
  readonly now: DateTime.Utc | null;
  readonly side: BatchSide;
  readonly t: TFunction;
  readonly yieldDto: EarnYieldWithProvider;
}): string | null => {
  const schedule = yieldDto.investmentSchedule;
  if (!schedule || !now) return null;
  const cutoff = getNextBatchCutoff(schedule, side, now);
  return cutoff ? formatDurationUntil(cutoff, now, t) : null;
};

/** Static batch timing, e.g. "Daily batch · 11:00 UTC"; null without one. */
export const formatDailyBatch = ({
  side,
  t,
  yieldDto,
}: {
  readonly side: BatchSide;
  readonly t: TFunction;
  readonly yieldDto: EarnYieldWithProvider;
}): string | null => {
  const schedule = yieldDto.investmentSchedule;
  const cutoff = schedule ? getDailyBatchCutoff(schedule, side) : null;
  return cutoff
    ? t("dashboard.earn_details.daily_batch", {
        time: cutoff.time,
        timezone: cutoff.timezone,
      })
    : null;
};
