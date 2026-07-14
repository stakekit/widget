import BigNumber from "bignumber.js";
import { useTranslation } from "react-i18next";
import type { Prices } from "../../../domain/schema/health-price-models";
import type {
  AppToken,
  FeeConfiguration,
} from "../../../domain/schema/legacy-models";

import { bpsToAmount, bpsToPercentage } from "../../../utils";
import { getFeesInUSD } from "../../../utils/formatters";
import type { FeesBps } from "../types";

export const useFees = ({
  amount,
  feeConfigDto,
  yieldFee,
  prices,
  token,
}: {
  readonly amount: BigNumber;
  readonly feeConfigDto: FeeConfiguration | null;
  readonly prices: Prices | null;
  readonly token: AppToken | null;
  readonly yieldFee?: {
    readonly deposit?: string;
    readonly management?: string;
    readonly performance?: string;
  } | null;
}): {
  readonly depositFee: FeesBps | null;
  readonly managementFee: FeesBps | null;
  readonly performanceFee: FeesBps | null;
} => {
  const { t } = useTranslation();
  const fromBps = (
    value: number | null | undefined,
    type: "deposit" | "management" | "performance"
  ): FeesBps | null =>
    value === null || value === undefined
      ? null
      : {
          explanation: t(`review.${type}_fee_explanation`),
          inPercentage: `${bpsToPercentage(value)}%`,
          inUSD: getFeesInUSD({
            amount: bpsToAmount(BigNumber(value), amount),
            prices,
            token,
          }),
          label: t(`review.${type}_fee`),
        };
  const fromPercentage = (
    value: string | null | undefined,
    type: "deposit" | "management" | "performance"
  ): FeesBps | null =>
    value === null || value === undefined
      ? null
      : {
          explanation: t(`review.${type}_fee_explanation`),
          inPercentage: `${value}%`,
          inUSD: getFeesInUSD({
            amount: amount.multipliedBy(value).dividedBy(100),
            prices,
            token,
          }),
          label: t(`review.${type}_fee`),
        };

  return {
    depositFee:
      fromBps(feeConfigDto?.depositFeeBps, "deposit") ??
      fromPercentage(yieldFee?.deposit, "deposit"),
    managementFee:
      fromBps(feeConfigDto?.managementFeeBps, "management") ??
      fromPercentage(yieldFee?.management, "management"),
    performanceFee:
      fromBps(feeConfigDto?.performanceFeeBps, "performance") ??
      fromPercentage(yieldFee?.performance, "performance"),
  };
};
