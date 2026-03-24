import BigNumber from "bignumber.js";
import { Just, type Maybe } from "purify-ts";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { FeeConfigurationDto } from "../../../domain/types/fees";
import type { Prices } from "../../../domain/types/price";
import type { TokenDto, YieldTokenDto } from "../../../domain/types/tokens";
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
  prices: Maybe<Prices>;
  token: Maybe<TokenDto | YieldTokenDto>;
  amount: BigNumber;
  feeConfigDto: Maybe<FeeConfigurationDto>;
  yieldFee?: {
    deposit?: string;
    management?: string;
    performance?: string;
  } | null;
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
    [amount, token, prices],
  );

  const getBpsInPercentage = useCallback(
    (val: number) => `${bpsToPercentage(val)}%`,
    [],
  );

  const getPercentAmount = useCallback(
    (val: string) => amount.multipliedBy(val).dividedBy(100),
    [amount],
  );

  const getPercentInUsd = useCallback(
    (val: string) =>
      getFeesInUSD({
        amount: Just(getPercentAmount(val)),
        prices,
        token,
      }),
    [getPercentAmount, prices, token],
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
        }))
        .altLazy(() =>
          Just(yieldFee?.deposit)
            .chainNullable((v) => v)
            .map<FeesBps>((val) => ({
              inUSD: getPercentInUsd(val),
              inPercentage: `${val}%`,
              explanation: t("review.deposit_fee_explanation"),
              label: t("review.deposit_fee"),
            })),
        ),
    [
      feeConfigDto,
      getFeeInUSD,
      getBpsInPercentage,
      getPercentInUsd,
      t,
      yieldFee,
    ],
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
        }))
        .altLazy(() =>
          Just(yieldFee?.management)
            .chainNullable((v) => v)
            .map<FeesBps>((val) => ({
              inUSD: getPercentInUsd(val),
              inPercentage: `${val}%`,
              explanation: t("review.management_fee_explanation"),
              label: t("review.management_fee"),
            })),
        ),
    [
      feeConfigDto,
      getFeeInUSD,
      getBpsInPercentage,
      getPercentInUsd,
      t,
      yieldFee,
    ],
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
        }))
        .altLazy(() =>
          Just(yieldFee?.performance)
            .chainNullable((v) => v)
            .map<FeesBps>((val) => ({
              inUSD: getPercentInUsd(val),
              inPercentage: `${val}%`,
              explanation: t("review.performance_fee_explanation"),
              label: t("review.performance_fee"),
            })),
        ),
    [
      feeConfigDto,
      getFeeInUSD,
      getBpsInPercentage,
      getPercentInUsd,
      t,
      yieldFee,
    ],
  );

  return { depositFee, managementFee, performanceFee };
};
