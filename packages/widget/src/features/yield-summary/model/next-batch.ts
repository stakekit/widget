import type { DateTime } from "effect";
import type { TFunction } from "i18next";
import {
  type BatchSide,
  getDailyBatchCutoff,
  getNextBatchCutoff,
  getPublishedBatchCutoff,
  isPublishedBatchDue,
} from "../../../domain/earn/batch-schedule";
import { isConfidentialYield } from "../../../domain/earn/confidential";
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

/** When the yield's next `side` batch runs: due any moment, or in a duration. */
export type NextBatchTiming =
  | { readonly _tag: "due" }
  | { readonly _tag: "in"; readonly duration: string };

/** The yield's next `side` batch timing, e.g. in "3 hours"; null without one. */
export const formatNextBatchTiming = ({
  now,
  side,
  t,
  yieldDto,
}: {
  readonly now: DateTime.Utc | null;
  readonly side: BatchSide;
  readonly t: TFunction;
  readonly yieldDto: EarnYieldWithProvider;
}): NextBatchTiming | null => {
  const schedule = yieldDto.investmentSchedule;
  if (!schedule || !now) return null;
  const confidential = isConfidentialYield(yieldDto);
  // A confidential batch past its live window dispatches any moment.
  if (confidential && isPublishedBatchDue(schedule, side, now)) {
    return { _tag: "due" };
  }
  // Confidential batches run on their live window, not a fixed daily cutoff.
  const cutoff = confidential
    ? getPublishedBatchCutoff(schedule, side, now)
    : getNextBatchCutoff(schedule, side, now);
  const duration = cutoff ? formatDurationUntil(cutoff, now, t) : null;
  return duration ? { _tag: "in", duration } : null;
};

/** Standalone timing label, e.g. "Next batch in 3 hours" or "Imminent". */
export const formatNextBatchLabel = (timing: NextBatchTiming, t: TFunction) =>
  timing._tag === "due"
    ? t("position_details.unstaking_imminent")
    : t("position_details.next_batch_in", { duration: timing.duration });

/** i18n options for copy with `_imminent` and `_timed` variants. */
export const getNextBatchCopyOptions = (
  timing: NextBatchTiming | null
): Readonly<{ context?: "imminent" | "timed"; duration?: string }> => {
  if (!timing) return {};
  if (timing._tag === "due") return { context: "imminent" };
  return { context: "timed", duration: timing.duration };
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
  if (isConfidentialYield(yieldDto)) return null;
  const schedule = yieldDto.investmentSchedule;
  const cutoff = schedule ? getDailyBatchCutoff(schedule, side) : null;
  return cutoff
    ? t("dashboard.earn_details.daily_batch", {
        time: cutoff.time,
        timezone: cutoff.timezone,
      })
    : null;
};
