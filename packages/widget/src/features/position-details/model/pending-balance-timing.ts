import { DateTime } from "effect";
import type { TFunction } from "i18next";

import { isConfidentialYield } from "../../../domain/earn/confidential";
import type { EarnYieldWithProvider } from "../../../domain/earn/yield-schema";
import type { PositionBalanceRow } from "../../../domain/portfolio/positions";
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
  now,
  row,
  t,
}: {
  readonly integrationData: EarnYieldWithProvider;
  readonly locale: string;
  readonly now: DateTime.Utc | null;
  readonly row: Pick<PositionBalanceRow, "cancelling" | "date" | "type">;
  readonly t: TFunction;
}): string | null => {
  const { type } = row;
  if (type !== "entering" && type !== "exiting") return null;
  if (row.cancelling) return t("position_details.cancelling");
  if (type === "exiting" && integrationData.providerId === "makina") {
    const pending = t("position_details.awaiting_finalization", {
      provider: integrationData.provider?.name ?? "Makina",
    });
    if (!row.date) return pending;
    const estimated = t("position_details.estimated_unlock", {
      date: formatDateTime(row.date, {
        locale,
        timeZone: DateTime.zoneMakeOffset(0),
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZoneName: "short",
      }),
    });
    return now && DateTime.isLessThanOrEqualTo(row.date, now)
      ? `${estimated} · ${pending}`
      : estimated;
  }
  if (!now) return null;
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
