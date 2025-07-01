import type { FeeConfigurationDto, TokenDto } from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { Just, type Maybe } from "purify-ts";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Prices } from "../../../domain/types/price";
import { bpsToAmount, bpsToPercentage } from "../../../utils";
import { getFeesInUSD } from "../../../utils/formatters";
import type { FeesBps } from "../types";

export const useFees = ({
  amount,
  feeConfigDto,
  prices,
  token,
}: {
  prices: Maybe<Prices>;
  token: Maybe<TokenDto>;
  amount: BigNumber;
  feeConfigDto: Maybe<FeeConfigurationDto>;
}): {
  depositFee: Maybe<FeesBps>;
  managementFee: Maybe<FeesBps>;
  performanceFee: Maybe<FeesBps>;
} => {
  const { t } = useTranslation();

  const getFeeInUSD = useCallback(
    (fee: number) =>
      getFeesInUSD({
        amount: Just(bpsToAmount(BigNumber(fee), amount)),
        prices,
        token,
      }),
    [amount, token, prices]
  );

  const getBpsInPercentage = useCallback(
    (val: number) => `${bpsToPercentage(val)}%`,
    []
  );

  const depositFee = useMemo(
    () =>
      feeConfigDto
        .chainNullable((v) => v.depositFeeBps)
        .map<FeesBps>((val) => ({
          inUSD: getFeeInUSD(val),
          inPercentage: getBpsInPercentage(val),
          explanation: t("review.deposit_fee_explanation"),
          label: t("review.deposit_fee"),
        })),
    [feeConfigDto, getFeeInUSD, getBpsInPercentage, t]
  );

  const managementFee = useMemo(
    () =>
      feeConfigDto
        .chainNullable((v) => v.managementFeeBps)
        .map<FeesBps>((val) => ({
          inUSD: getFeeInUSD(val),
          inPercentage: getBpsInPercentage(val),
          explanation: t("review.management_fee_explanation"),
          label: t("review.management_fee"),
        })),
    [feeConfigDto, getFeeInUSD, getBpsInPercentage, t]
  );

  const performanceFee = useMemo(
    () =>
      feeConfigDto
        .chainNullable((v) => v.performanceFeeBps)
        .map<FeesBps>((val) => ({
          inUSD: getFeeInUSD(val),
          inPercentage: getBpsInPercentage(val),
          explanation: t("review.performance_fee_explanation"),
          label: t("review.performance_fee"),
        })),
    [feeConfigDto, getFeeInUSD, getBpsInPercentage, t]
  );

  return { depositFee, managementFee, performanceFee };
};
