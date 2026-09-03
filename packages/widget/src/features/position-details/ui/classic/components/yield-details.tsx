import type { TFunction } from "i18next";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { EarnYieldWithProvider } from "../../../../../domain/earn/models";
import { getEffectiveYieldRewardRateDetails } from "../../../../../domain/earn/reward-rate";
import {
  getExtendedYieldType,
  getYieldFeePercent,
  getYieldLockupPeriod,
  getYieldRiskDisplay,
  getYieldTvlUsd,
  getYieldWarmupPeriod,
} from "../../../../../domain/earn/yield";
import { humanizeEnumValue } from "../../../../../shared/lib/formatters";
import { APToPercentage } from "../../../../../shared/lib/general";
import { SKAnchor } from "../../../../../shared/ui/primitives/anchor";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import {
  formatMeaningfulCompactUsd,
  formatOptionalDays,
  formatPricePerShare,
  formatProviderWebsite,
  formatProviderWebsiteHref,
  formatRewardClaiming,
  formatRewardRate,
  formatRewardRateLabel,
} from "../../../../yield-summary/index";
import { RiskRatingBadge } from "../../../../yield-summary/views";
import { PositionSourceDetails } from "./position-source-details";

type YieldDetail = {
  id: string;
  label: string;
  value: ReactNode;
};

export const YieldDetails = ({
  integrationData,
  showRewardRate,
}: {
  integrationData: EarnYieldWithProvider;
  showRewardRate: boolean;
}) => {
  const { t } = useTranslation();
  const provider = integrationData.provider;
  const providerName = provider?.name ?? integrationData.metadata.name;
  const details = getYieldDetails({
    integrationData,
    showRewardRate,
    t,
  });

  return (
    <PositionSourceDetails
      hasDetails={details.length > 0}
      isFirst
      logo={provider?.logoURI ?? integrationData.metadata.logoURI}
      name={providerName}
      stakeType={t(
        `position_details.stake_type.${getExtendedYieldType(integrationData)}`
      )}
    >
      {details.length > 0 ? (
        <Box marginTop="1">
          {details.map((detail) => (
            <Box
              key={detail.id}
              marginTop="1"
              marginBottom="3"
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              gap="3"
            >
              <Text variant={{ weight: "normal" }}>{detail.label}</Text>
              <Text variant={{ type: "muted", weight: "normal" }}>
                {detail.value}
              </Text>
            </Box>
          ))}
        </Box>
      ) : null}
    </PositionSourceDetails>
  );
};

const getYieldDetails = ({
  integrationData,
  showRewardRate,
  t,
}: {
  integrationData: EarnYieldWithProvider;
  showRewardRate: boolean;
  t: TFunction;
}): YieldDetail[] => {
  const website = integrationData.provider?.website;
  const rewardRate = showRewardRate
    ? formatRewardRate(
        getEffectiveYieldRewardRateDetails({ yieldDto: integrationData }),
        integrationData
      )
    : null;
  const warmup = formatOptionalDays(
    getYieldWarmupPeriod(integrationData)?.days,
    t
  );
  const lockup = formatOptionalDays(
    getYieldLockupPeriod(integrationData)?.days,
    t
  );
  const rewardSchedule = humanizeEnumValue(
    integrationData.mechanics.rewardSchedule
  );
  const additionalDetail = getAdditionalYieldDetail(integrationData, t);

  return [
    website
      ? {
          id: "website",
          label: t("details.validators_website"),
          value: (
            <SKAnchor href={formatProviderWebsiteHref(website)}>
              {formatProviderWebsite(website)}
            </SKAnchor>
          ),
        }
      : null,
    rewardRate
      ? {
          id: "reward-rate",
          label: formatRewardRateLabel(integrationData, t),
          value: rewardRate,
        }
      : null,
    {
      id: "reward-claiming",
      label: t("dashboard.earn_details.reward_claiming"),
      value: formatRewardClaiming(integrationData, t),
    },
    rewardSchedule
      ? {
          id: "reward-schedule",
          label: t("dashboard.earn_details.reward_schedule"),
          value: rewardSchedule,
        }
      : null,
    warmup
      ? {
          id: "warmup",
          label: t("dashboard.earn_details.warmup"),
          value: warmup,
        }
      : null,
    lockup
      ? {
          id: "lockup",
          label: t("dashboard.earn_details.lockup"),
          value: lockup,
        }
      : null,
    additionalDetail,
  ].filter((detail): detail is YieldDetail => detail !== null);
};

const getAdditionalYieldDetail = (
  integrationData: EarnYieldWithProvider,
  t: TFunction
): YieldDetail | null => {
  const fee = getYieldFeePercent(integrationData);
  if (fee !== null) {
    return {
      id: "fees",
      label: t("shared.fees"),
      value: `${APToPercentage(fee)}%`,
    };
  }

  const pricePerShare = formatPricePerShare(integrationData);
  if (pricePerShare) {
    return {
      id: "price-per-share",
      label: t("dashboard.earn_details.price_per_share"),
      value: pricePerShare,
    };
  }

  const tvl = formatMeaningfulCompactUsd(getYieldTvlUsd(integrationData));
  if (tvl) {
    return {
      id: "tvl",
      label: t("dashboard.earn_details.tvl"),
      value: tvl,
    };
  }

  const risk = getYieldRiskDisplay(integrationData);
  return risk
    ? {
        id: "risk",
        label: t("dashboard.earn_details.risk"),
        value: <RiskRatingBadge risk={risk} />,
      }
    : null;
};
