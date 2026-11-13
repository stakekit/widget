import { DateTime } from "effect";
import type { TFunction } from "i18next";

import { isConfidentialYield } from "../../../domain/earn/confidential";
import { isMakinaYield } from "../../../domain/earn/yield";
import type { EarnYieldWithProvider } from "../../../domain/earn/yield-schema";
import type { PositionBalanceRow } from "../../../domain/portfolio/positions";
import type { PresentationTime } from "../../../shared/effect/presentation-clock";
import { formatDateTime } from "../../../shared/lib/date";
import {
  formatDurationUntil,
  formatNextBatchLabel,
  formatNextBatchTiming,
} from "../../yield-presentation/index";

/**
 * When a pending balance settles: its own date first, else the vault's next
 * batch. A balance being cancelled shows that instead. Null for settled
 * balances or without presentation time.
 */
export const formatPendingBalanceTiming = ({
  integrationData,
  locale,
  presentationTime,
  row,
  t,
}: {
  readonly integrationData: EarnYieldWithProvider;
  readonly locale: string;
  readonly presentationTime: PresentationTime | null;
  readonly row: Pick<PositionBalanceRow, "cancelling" | "date" | "type">;
  readonly t: TFunction;
}): string | null => {
  const { type } = row;
  if (type !== "entering" && type !== "exiting") return null;
  if (row.cancelling) return t("position_details.cancelling");
  if (type === "exiting" && isMakinaYield(integrationData)) {
    return formatMakinaExitTiming({
      date: row.date,
      integrationData,
      locale,
      presentationTime,
      t,
    });
  }
  if (!presentationTime) return null;
  const { now } = presentationTime;
  if (row.date) {
    const duration = formatDurationUntil(row.date, now, t);
    return duration
      ? t("position_details.unstaking_duration", { duration })
      : t("position_details.unstaking_imminent");
  }
  // Only the API knows which batch a confidential balance is in; without its
  // date, the vault's next window would be a guess.
  if (isConfidentialYield(integrationData)) return null;
  const nextBatch = formatNextBatchTiming({
    now,
    side: type === "entering" ? "subscription" : "redemption",
    t,
    yieldDto: integrationData,
  });
  return nextBatch ? formatNextBatchLabel(nextBatch, t) : null;
};

/**
 * A Makina withdrawal's date is an estimate: from it on, the withdrawal still
 * waits for the provider to finalize it.
 */
const formatMakinaExitTiming = ({
  date,
  integrationData,
  locale,
  presentationTime,
  t,
}: {
  readonly date: PositionBalanceRow["date"];
  readonly integrationData: EarnYieldWithProvider;
  readonly locale: string;
  readonly presentationTime: PresentationTime | null;
  readonly t: TFunction;
}) => {
  const pending = t("position_details.awaiting_finalization", {
    provider: integrationData.provider?.name ?? integrationData.providerId,
  });
  if (!date) return pending;
  if (!presentationTime) return null;
  const estimated = t("position_details.estimated_unlock", {
    date: formatDateTime(date, {
      locale,
      timeZone: presentationTime.timeZone,
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
  });
  return DateTime.isLessThanOrEqualTo(date, presentationTime.now)
    ? `${estimated} · ${pending}`
    : estimated;
};
