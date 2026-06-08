import BigNumber from "bignumber.js";
import clsx from "clsx";
import { Trans, useTranslation } from "react-i18next";
import { Box } from "../../../../../components/atoms/box";
import { Divider } from "../../../../../components/atoms/divider";
import { MorphoStarsIcon } from "../../../../../components/atoms/icons/morpho-stars";
import { Image } from "../../../../../components/atoms/image";
import { Text } from "../../../../../components/atoms/typography/text";
import { RewardRateBreakdown } from "../../../../../components/molecules/reward-rate-breakdown";
import { isMorphoProvider } from "../../../../../components/molecules/reward-token-details";
import { getEffectiveYieldRewardRateDetails } from "../../../../../domain/types/reward-rate";
import type {
  TokenDto,
  YieldTokenDto,
} from "../../../../../domain/types/tokens";
import {
  getYieldOutputToken,
  getYieldTypeLabels,
} from "../../../../../domain/types/yields";
import { VerticalDivider } from "../../../../../pages-dashboard/common/components/divider";
import { useSettings } from "../../../../../providers/settings";
import { formatNumber } from "../../../../../utils";
import { combineRecipeWithVariant } from "../../../../../utils/styles";
import { useEarnPageContext } from "../../state/earn-page-context";
import { selectYieldRewardsText } from "./styles.css";

export const SelectYieldRewardDetails = () => {
  const { variant } = useSettings();
  const { t } = useTranslation();

  const {
    rewardToken,
    estimatedRewards,
    rewardsTokenSymbol,
    selectedStake,
    selectedValidators,
    stakeAmount,
    providersDetails,
  } = useEarnPageContext();

  const rewardRateDetails = selectedStake.chainNullable((yieldDto) =>
    getEffectiveYieldRewardRateDetails({ selectedValidators, yieldDto })
  );

  const earnYearly = estimatedRewards.mapOrDefault(
    (e) => `${e.yearly} ${rewardsTokenSymbol}`,
    ""
  );
  const earnMonthly = estimatedRewards.mapOrDefault(
    (e) => `${e.monthly} ${rewardsTokenSymbol}`,
    ""
  );
  const strategyDetails = selectedStake.map((yieldDto) => {
    const outputToken = getYieldOutputToken(yieldDto).extractNullable();
    const providerDetails = providersDetails
      .chainNullable((val) => val[0])
      .extractNullable();
    const providerName =
      providerDetails?.name ??
      yieldDto.provider?.name ??
      yieldDto.providerId ??
      yieldDto.metadata.name;
    const pricePerShare = new BigNumber(
      yieldDto.state?.pricePerShareState?.price ?? 1
    );
    const outputAmount =
      pricePerShare.isFinite() && !pricePerShare.isZero()
        ? stakeAmount.dividedBy(pricePerShare)
        : stakeAmount;

    return {
      outputAmount: formatNumber(outputAmount, 6),
      outputToken,
      providerLogo:
        providerDetails?.logo ?? yieldDto.provider?.logoURI ?? undefined,
      providerName,
      yieldType: getYieldTypeLabels(yieldDto, t).title,
    };
  });

  return (
    <Box data-rk="yield-rewards">
      <Box display="flex" flexDirection="column" gap="4" marginTop="3">
        {variant !== "zerion" && (
          <>
            {strategyDetails
              .map((details) => <YieldStrategyDetails {...details} />)
              .extractNullable()}

            <Divider />
          </>
        )}

        {variant === "zerion" &&
          rewardToken
            .map((rt) => (
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                gap="2"
              >
                <Text variant={{ type: "muted", weight: "normal" }}>
                  <Trans
                    i18nKey="details.rewards.receive"
                    components={{
                      symbols1: (
                        <Box as="span" fontWeight="bold">
                          {rt.symbols}
                        </Box>
                      ),
                    }}
                  />
                </Text>

                <Box
                  display="flex"
                  justifyContent="center"
                  alignItems="center"
                  flexShrink={0}
                >
                  {rt.logoUri && (
                    <Box
                      marginRight="1"
                      display="flex"
                      justifyContent="center"
                      alignItems="center"
                      gap="1"
                    >
                      <Image
                        imgProps={{ borderRadius: "full" }}
                        wrapperProps={{ hw: "5" }}
                        src={rt.logoUri}
                        fallbackName={rt.providerName}
                      />

                      {isMorphoProvider(rt.providerName) && (
                        <Box width="5" height="5">
                          <MorphoStarsIcon />
                        </Box>
                      )}
                    </Box>
                  )}
                  <Text variant={{ type: "muted", weight: "normal" }}>
                    {rt.providerName}
                  </Text>
                </Box>
              </Box>
            ))
            .extractNullable()}

        {variant === "utila" || variant === "porto" ? (
          <UtilaEarnYearlyOrMonthly
            earnMonthly={earnMonthly}
            earnYearly={earnYearly}
          />
        ) : (
          <DefaultEarnYearlyOrMonthly
            earnMonthly={earnMonthly}
            earnYearly={earnYearly}
          />
        )}

        {rewardRateDetails
          .map((rewardRate) => (
            <RewardRateBreakdown
              rewardRate={rewardRate}
              showUpToCampaign
              title={t("details.apy_composition.title")}
              testId="reward-rate-breakdown"
            />
          ))
          .extractNullable()}
      </Box>
    </Box>
  );
};

const YieldStrategyDetails = ({
  outputAmount,
  outputToken,
  providerLogo,
  providerName,
  yieldType,
}: {
  outputAmount: string;
  outputToken: TokenDto | YieldTokenDto | null;
  providerLogo: string | undefined;
  providerName: string;
  yieldType: string;
}) => {
  const { t } = useTranslation();

  return (
    <Box
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      gap="2"
      flexWrap="wrap"
    >
      {outputToken ? (
        <Text variant={{ type: "muted", weight: "normal" }}>
          {t("details.rewards.receive_output")}{" "}
          <Text as="span" variant={{ weight: "bold" }}>
            {outputAmount}
          </Text>{" "}
          {outputToken.symbol}
        </Text>
      ) : (
        <Text variant={{ type: "muted", weight: "normal" }}>
          {t("details.yield_strategy")}
        </Text>
      )}

      <Box display="flex" alignItems="center" gap="1">
        {!outputToken && (
          <Text variant={{ type: "muted", weight: "normal" }}>{yieldType}</Text>
        )}

        <Image
          imgProps={{ borderRadius: "base" }}
          wrapperProps={{ hw: "5" }}
          src={providerLogo}
          fallbackName={providerName}
        />

        <Text variant={{ type: "muted", weight: "normal" }}>
          {t("details.via", { providerName })}
        </Text>
      </Box>
    </Box>
  );
};

const DefaultEarnYearlyOrMonthly = ({
  earnMonthly,
  earnYearly,
}: {
  earnMonthly: string;
  earnYearly: string;
}) => {
  const { t } = useTranslation();

  const { variant } = useSettings();

  return (
    <>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        data-testid="estimated-reward__yearly"
        data-rk="estimated-reward__yearly"
        gap="2"
      >
        <Text
          variant={{ type: "muted", weight: "normal" }}
          className={clsx(
            combineRecipeWithVariant({
              rec: selectYieldRewardsText,
              variant,
            })
          )}
        >
          {t(variant === "zerion" ? "details.rewards.yearly" : "shared.yearly")}
        </Text>
        <Text
          variant={{ type: "muted", weight: "normal" }}
          className={clsx(
            combineRecipeWithVariant({
              rec: selectYieldRewardsText,
              variant,
            })
          )}
        >
          {earnYearly}
        </Text>
      </Box>

      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        data-testid="estimated-reward__monthly"
        data-rk="estimated-reward__monthly"
        gap="2"
      >
        <Text
          variant={{ type: "muted", weight: "normal" }}
          className={clsx(
            combineRecipeWithVariant({
              rec: selectYieldRewardsText,
              variant,
            })
          )}
        >
          {t("shared.monthly")}
        </Text>
        <Text
          variant={{ type: "muted", weight: "normal" }}
          className={clsx(
            combineRecipeWithVariant({
              rec: selectYieldRewardsText,
              variant,
            })
          )}
        >
          {earnMonthly}
        </Text>
      </Box>
    </>
  );
};

const UtilaEarnYearlyOrMonthly = ({
  earnMonthly,
  earnYearly,
}: {
  earnMonthly: string;
  earnYearly: string;
}) => {
  const { t } = useTranslation();

  return (
    <Box display="flex" alignItems="center" gap="3" flexWrap="wrap">
      <Box display="flex" alignItems="center" gap="2">
        <Text variant={{ weight: "normal" }}>{t("shared.yearly")}</Text>
        <Text variant={{ weight: "normal" }}>{earnYearly}</Text>
      </Box>

      <VerticalDivider />

      <Box display="flex" alignItems="center" gap="2">
        <Text variant={{ weight: "normal" }}>{t("shared.monthly")}</Text>
        <Text variant={{ weight: "normal" }}>{earnMonthly}</Text>
      </Box>
    </Box>
  );
};
