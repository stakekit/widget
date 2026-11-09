import type BigNumber from "bignumber.js";
import type { TFunction } from "i18next";
import {
  getEffectiveYieldRewardRateDetails,
  type SelectedValidators,
} from "../../../domain/earn/reward-rate";
import { getYieldTvl, getYieldTvlUsd } from "../../../domain/earn/yield";
import type { EarnYieldWithProvider } from "../../../domain/earn/yield-schema";
import { exactDecimal } from "../../../domain/finance/exact";
import { formatCompactNumber } from "../../../shared/lib/number-format";
import {
  formatMeaningfulCompactUsd,
  formatRateTypeLabel,
  formatRewardRate,
} from "./yield-details-formatters";

/** A reward rate with the type it is quoted in. */
export type YieldRateFigure = {
  /** Names the rate's type, such as "APY" or "APR". */
  readonly label: string;
  /** The rate's type as the API states it, such as "variable". */
  readonly rateType: string;
  /** The rate, such as "4.20%". */
  readonly value: string;
  /** The exact ratio `value` reads, such as 0.042, for a figure that counts to it. */
  readonly ratio: BigNumber;
};

export type YieldTvlFigure = {
  /** The TVL in USD, such as "$1.98M". */
  readonly usd: string;
  /** The TVL in the yield's token units, such as "≈ 883.29 ETH". */
  readonly token: string | null;
};

/**
 * The figures a yield is compared and chosen by, formatted once so its list
 * row, its picker row, its details and the Earn form read them alike.
 */
export type YieldFigures = {
  readonly rate: YieldRateFigure | null;
  readonly tvl: YieldTvlFigure | null;
};

/**
 * A TVL in the yield's token units with the token's symbol, such as
 * "883.29 ETH": the TVL chart's points and its header's token figure both
 * read through it, so they agree.
 */
export const formatTvlAmount = (
  amount: BigNumber | number,
  symbol: string,
  locale: string
) => `${formatCompactNumber(amount, locale)} ${symbol}`;

/**
 * The yield's figures. The rate is the selected validators' when any are
 * selected, else the yield's own.
 */
export const getYieldFigures = ({
  locale,
  selectedValidators = null,
  t,
  yieldDto,
}: {
  readonly locale: string;
  readonly selectedValidators?: SelectedValidators | null;
  readonly t: TFunction;
  readonly yieldDto: EarnYieldWithProvider;
}): YieldFigures => {
  const effectiveRate = getEffectiveYieldRewardRateDetails({
    selectedValidators,
    yieldDto,
  });
  const rate = formatRewardRate(effectiveRate, yieldDto, locale);
  const usd = formatMeaningfulCompactUsd(getYieldTvlUsd(yieldDto), locale);
  const tokenTvl = getYieldTvl(yieldDto);

  return {
    rate:
      rate && effectiveRate
        ? {
            label: formatRateTypeLabel(effectiveRate.rateType, t),
            rateType: effectiveRate.rateType,
            value: rate,
            ratio: exactDecimal(effectiveRate.total),
          }
        : null,
    tvl: usd
      ? {
          usd,
          token: tokenTvl?.isGreaterThan(0)
            ? t("dashboard.earn_details.tvl_in_token", {
                amount: formatTvlAmount(
                  tokenTvl,
                  yieldDto.token.symbol,
                  locale
                ),
              })
            : null,
        }
      : null,
  };
};
