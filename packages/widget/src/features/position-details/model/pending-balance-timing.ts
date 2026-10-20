import type { DateTime } from "effect";
import type { TFunction } from "i18next";
import type { EarnYieldWithProvider } from "../../../domain/earn/models";
import type { PositionBalanceRow } from "../../../domain/portfolio/positions";
import {
  formatDurationUntil,
  formatNextBatchLabel,
  formatNextBatchTiming,
} from "../../yield-summary/index";

/**
 * When a pending balance settles: its own date first, else the vault's next
 * batch. Null for settled balances or without presentation time.
 */
export const formatPendingBalanceTiming = ({
  integrationData,
  now,
  row,
  t,
}: {
  readonly integrationData: EarnYieldWithProvider;
  readonly now: DateTime.Utc | null;
  readonly row: Pick<PositionBalanceRow, "batch" | "date" | "type">;
  readonly t: TFunction;
}): string | null => {
  const { type } = row;
  if ((type !== "entering" && type !== "exiting") || !now) return null;
  if (row.date) {
    const duration = formatDurationUntil(row.date, now, t);
    return duration
      ? t("position_details.unstaking_duration", { duration })
      : t("position_details.unstaking_imminent");
  }
  // A balance already in a dispatched batch no longer waits for the next one.
  if (row.batch) return null;
  const nextBatch = formatNextBatchTiming({
    now,
    side: type === "entering" ? "subscription" : "redemption",
    t,
    yieldDto: integrationData,
  });
  return nextBatch ? formatNextBatchLabel(nextBatch, t) : null;
};
