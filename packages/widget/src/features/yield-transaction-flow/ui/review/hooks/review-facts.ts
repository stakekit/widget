import { Duration } from "effect";
import type { TFunction } from "i18next";
import type { EarnYieldWithProvider } from "../../../../../domain/earn/models";
import {
  getYieldCooldownDuration,
  getYieldLockupDuration,
} from "../../../../../domain/earn/yield";
import {
  formatCooldownDays,
  formatDailyBatch,
} from "../../../../yield-summary/index";
import {
  formatTransactionTypeLabel,
  type YieldFlowTransactionToSign,
} from "../../../model/yield-transaction-workflow";
import type { ReviewFact } from "../pages/review-overview";

/**
 * How many wallet signatures the flow still takes, and what each signs.
 * Waits while they are worked out; nothing once none could be.
 */
export const getSignaturesFact = ({
  loading,
  t,
  transactions,
}: {
  readonly loading: boolean;
  readonly t: TFunction;
  readonly transactions: ReadonlyArray<YieldFlowTransactionToSign> | null;
}): ReviewFact | null => {
  const label = t("review.signatures");
  if (loading) return { label, loading: true, testId: "review-signatures" };
  if (!transactions || transactions.length === 0) return null;

  return {
    caption: transactions
      .map((type) => formatTransactionTypeLabel(type, t))
      .join(", "),
    label,
    testId: "review-signatures",
    value: String(transactions.length),
  };
};

/**
 * A period to the unit that keeps it honest: whole days from a day up,
 * otherwise hours, otherwise minutes, each rounded up below a day so a short
 * period never reads as none.
 */
const formatPeriod = (period: Duration.Duration, t: TFunction) => {
  if (Duration.isGreaterThanOrEqualTo(period, Duration.days(1))) {
    return formatCooldownDays(Math.round(Duration.toDays(period)), t);
  }
  if (Duration.isGreaterThanOrEqualTo(period, Duration.hours(1))) {
    return t("position_details.duration.hours", {
      count: Math.ceil(Duration.toHours(period)),
    });
  }
  return t("position_details.duration.minutes", {
    count: Math.max(Math.ceil(Duration.toMinutes(period)), 1),
  });
};

/**
 * How long leaving the yield takes: its redemption batch, its cooldown, or
 * instant.
 */
export const getUnlockPeriodFact = (
  yieldDto: EarnYieldWithProvider,
  t: TFunction
): ReviewFact => {
  const cooldown = getYieldCooldownDuration(yieldDto);

  return {
    label: t("review.unlock_period"),
    testId: "review-unlock-period",
    value:
      formatDailyBatch({ side: "redemption", t, yieldDto }) ??
      (cooldown ? formatPeriod(cooldown, t) : formatCooldownDays(0, t)),
  };
};

/** How long a deposit stays locked before it can be exited; null without. */
export const getLockupPeriodFact = (
  yieldDto: EarnYieldWithProvider,
  t: TFunction
): ReviewFact | null => {
  const lockup = getYieldLockupDuration(yieldDto);

  return lockup
    ? {
        label: t("review.lockup_period"),
        testId: "review-lockup-period",
        value: formatPeriod(lockup, t),
      }
    : null;
};

/** Where the amount goes or comes from: the yield, and who provides it. */
export const formatReviewDestination = ({
  providerName,
  t,
  yieldName,
}: {
  readonly providerName: string | undefined;
  readonly t: TFunction;
  readonly yieldName: string;
}) =>
  providerName && providerName !== yieldName
    ? t("review.destination", { providerName, yieldName })
    : yieldName;
