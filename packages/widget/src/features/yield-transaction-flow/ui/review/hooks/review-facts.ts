import type BigNumber from "bignumber.js";
import { Duration } from "effect";
import type { TFunction } from "i18next";

import {
  getYieldCooldownDuration,
  getYieldLockupDuration,
} from "../../../../../domain/earn/yield";
import type { EarnYieldWithProvider } from "../../../../../domain/earn/yield-schema";
import { getTokenPriceInUSD } from "../../../../../domain/finance/price";
import type { Prices } from "../../../../../domain/finance/prices";
import type { Token } from "../../../../../domain/token/token";
import { getFeesInUSD } from "../../../../../shared/lib/formatters";
import { formatRoundedPercent } from "../../../../../shared/lib/number-format";
import {
  formatCooldownDays,
  formatDailyBatch,
} from "../../../../yield-presentation/index";
import {
  formatTransactionTypeLabel,
  type YieldFlowTransactionToSign,
} from "../../../model/yield-transaction-workflow";
import type { ReviewFact } from "../pages/review-overview";
import type { FeesBps } from "../types";

/**
 * A yield fee as the Review lists it: its percent, its amount with the USD
 * value, and its label and explanation; null when the yield charges none.
 */
export const localizeReviewFee = ({
  fee,
  locale,
  prices,
  t,
  token,
  type,
}: {
  readonly fee: Readonly<{ amount: BigNumber; ratio: BigNumber }> | null;
  readonly locale: string;
  readonly prices: Prices | null;
  readonly t: TFunction;
  readonly token: Token;
  readonly type: "deposit" | "withdrawal" | "management" | "performance";
}): FeesBps | null =>
  fee
    ? {
        inPercentage: formatRoundedPercent(fee.ratio, locale),
        inUSD: getFeesInUSD({ amount: fee.amount, locale, prices, token }),
        explanation: t(`review.${type}_fee_explanation`),
        label: t(`review.${type}_fee`),
      }
    : null;

/** A token amount's USD value; null when it or its price is unknown. */
export const getReviewUsdValue = ({
  amount,
  prices,
  token,
}: {
  readonly amount: BigNumber | null;
  readonly prices: Prices | null;
  readonly token: Token;
}): BigNumber | null => {
  if (!amount || !prices) return null;
  const usd = getTokenPriceInUSD({
    amount,
    baseToken: null,
    pricePerShare: null,
    prices,
    token,
  });
  return usd.isGreaterThan(0) ? usd : null;
};

/**
 * A warning when the network fee takes at least half of what the action is
 * worth: claiming rewards the fee eats, or moving an amount it eats. Without
 * both USD values nothing compares, so nothing warns.
 */
export const getNetworkFeeWarning = ({
  feeUsd,
  subject,
  t,
  valueUsd,
}: {
  readonly feeUsd: BigNumber | null;
  /** `rewards` for claiming rewards, `amount` for any other action. */
  readonly subject: "amount" | "rewards";
  readonly t: TFunction;
  readonly valueUsd: BigNumber | null;
}): Readonly<{ readonly message: string; readonly title: string }> | null => {
  if (!feeUsd || !valueUsd?.isGreaterThan(0)) return null;
  if (feeUsd.isLessThan(valueUsd.dividedBy(2))) return null;
  const extent = feeUsd.isGreaterThanOrEqualTo(valueUsd) ? "exceeds" : "half";
  return {
    message: t(`review.fee_warning.${subject}_${extent}`),
    title: t("review.fee_warning.title"),
  };
};

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
