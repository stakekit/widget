import type BigNumber from "bignumber.js";

import {
  formatPairedTokenAmounts,
  formatTokenAmount,
  formatUsd,
  unavailableFigure,
  withFigureUnit,
} from "../../../../../shared/lib/number-format";
import { getEstimatedRewardsUsd } from "../../../../yield-summary/index";

/**
 * A figure computed from the entered amount, such as the amount received or
 * the estimated rewards: unavailable until the user enters an amount, so an
 * empty input never reads as 0. The unit follows a computed figure only, so
 * the placeholder reads "—" rather than "— ETH".
 */
export const formatEntryFigure = ({
  amount,
  amountEntered,
  locale,
  unit,
}: {
  readonly amount: BigNumber | null;
  readonly amountEntered: boolean;
  readonly locale: string;
  readonly unit?: string;
}) => {
  if (!amountEntered || !amount) return unavailableFigure;
  const figure = formatTokenAmount(amount, locale, "nearest");
  return unit ? withFigureUnit(figure, unit) : figure;
};

/**
 * The estimated yearly and monthly rewards, each in the reward token and, for
 * a priced amount, in USD ("0.0834 ETH", "$243.10"): the token pair shares
 * one decimal count and the USD pair cents, so the two lines read alike.
 * Null before the user enters an amount, when a hint takes their place
 * instead of placeholders.
 */
export const formatEstimatedRewards = ({
  amountEntered,
  amountUsd,
  estimatedRewards,
  locale,
  unit,
}: {
  readonly amountEntered: boolean;
  readonly amountUsd: BigNumber | null;
  readonly estimatedRewards: {
    readonly monthly: BigNumber | null;
    readonly rewardRateAverage: BigNumber;
    readonly yearly: BigNumber | null;
  } | null;
  readonly locale: string;
  readonly unit: string;
}) => {
  if (!amountEntered || !estimatedRewards) return null;
  const [yearlyToken = unavailableFigure, monthlyToken = unavailableFigure] =
    formatPairedTokenAmounts(
      [estimatedRewards.yearly, estimatedRewards.monthly],
      locale,
      "nearest"
    );
  const usd = getEstimatedRewardsUsd({ amountUsd, estimatedRewards });
  const pair = (token: string, usdValue: BigNumber | undefined) => {
    const figure = withFigureUnit(token, unit);
    return {
      token: figure,
      usd:
        usdValue && figure !== unavailableFigure
          ? formatUsd(usdValue, locale)
          : null,
    };
  };

  return {
    monthly: pair(monthlyToken, usd?.monthly),
    yearly: pair(yearlyToken, usd?.yearly),
  } as const;
};
