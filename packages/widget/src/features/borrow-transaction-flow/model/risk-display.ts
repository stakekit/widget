import type BigNumber from "bignumber.js";
import type { TFunction } from "i18next";
import type { RiskBand } from "../../../domain/borrow/risk/risk-band";
import {
  formatLtv,
  formatPercent,
  toChartNumber,
} from "../../../shared/lib/number-format";

/**
 * How each risk band reads on every part that shows it. Safe reads plain:
 * green is for positive rates and claimable amounts only, so only caution and
 * danger take a status color.
 */
export type RiskValueTone = "default" | "warning" | "danger";

/** The text tone of an LTV or health factor in its band. */
export const riskBandValueTone = {
  safe: "default",
  caution: "warning",
  danger: "danger",
} as const satisfies Record<RiskBand, RiskValueTone>;

/** A risk meter's fill in its band; a safe one keeps the meter's accent. */
export const riskBandMeterTone = {
  safe: "accent",
  caution: "warning",
  danger: "danger",
} as const satisfies Record<RiskBand, "accent" | "warning" | "danger">;

/** A loan to value as a 0–100% gauge, with max LTV marked when known. */
export type LtvMeter = {
  readonly value: number;
  readonly valueText: string;
  readonly marker?: { readonly value: number; readonly label: string };
};

/** A loan to value as a thin details-row meter, with max LTV marked. */
export const toLtvMeter = ({
  locale,
  ltv,
  maxLtv,
  t,
}: {
  readonly locale: string;
  readonly ltv: BigNumber;
  readonly maxLtv: BigNumber | null;
  readonly t: TFunction;
}): LtvMeter => ({
  value: Math.min(100, toChartNumber(ltv.multipliedBy(100))),
  valueText: formatLtv(ltv, locale),
  ...(maxLtv === null
    ? {}
    : {
        marker: {
          value: toChartNumber(maxLtv.multipliedBy(100)),
          label: t("dashboard.borrow.risk.max_ltv_marker", {
            value: formatPercent(maxLtv, locale),
          }),
        },
      }),
});
