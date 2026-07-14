import BigNumber from "bignumber.js";
import { Trans, useTranslation } from "react-i18next";
import { Box } from "../../../../../components/atoms/box";
import { Divider } from "../../../../../components/atoms/divider";
import { MorphoStarsIcon } from "../../../../../components/atoms/icons/morpho-stars";
import { Image } from "../../../../../components/atoms/image";
import { Text } from "../../../../../components/atoms/typography/text";
import { EstimatedRewardAmounts } from "../../../../../components/molecules/estimated-reward-amounts";
import { RewardRateBreakdown } from "../../../../../components/molecules/reward-rate-breakdown";
import { isMorphoProvider } from "../../../../../components/molecules/reward-token-details";
import type { EarnValidator } from "../../../../../domain/schema/earn-models";
import type { AppToken } from "../../../../../domain/schema/legacy-models";
import { getEffectiveYieldRewardRateDetails } from "../../../../../domain/types/reward-rate";

import {
  getYieldOutputToken,
  getYieldTypeLabels,
} from "../../../../../domain/types/yields";
import { useSettings } from "../../../../../providers/settings";
import { formatNumber } from "../../../../../utils";
import { useEarnPageContext } from "../../state/earn-page-context";
import { viaProviderImage } from "./styles.css";

type StrategyProvider = {
  key: string;
  logo: string | undefined;
  name: string;
};

export const SelectYieldRewardDetails = () => {
  const { dashboardVariant, variant } = useSettings();
  const { t } = useTranslation();
  const showYieldStrategyDetails = variant !== "zerion";

  const {
    rewardToken,
    estimatedRewards,
    rewardsTokenSymbol,
    selectedStake,
    selectedValidators,
    stakeAmount,
    providersDetails,
  } = useEarnPageContext();

  const rewardRateDetails = selectedStake
    ? getEffectiveYieldRewardRateDetails({
        selectedValidators,
        yieldDto: selectedStake,
      })
    : null;

  const earnYearly = estimatedRewards
    ? `${estimatedRewards.yearly} ${rewardsTokenSymbol}`
    : "";
  const earnMonthly = estimatedRewards
    ? `${estimatedRewards.monthly} ${rewardsTokenSymbol}`
    : "";
  const strategyDetails = selectedStake
    ? (() => {
        const yieldDto = selectedStake;
        const outputToken = getYieldOutputToken(yieldDto);
        const selectedValidatorsArr = [...selectedValidators.values()];
        const providersDetailsArr = providersDetails ?? [];
        const strategyProviders = selectedValidatorsArr.length
          ? selectedValidatorsArr.map<StrategyProvider>((validator, index) => {
              const providerDetails = providersDetailsArr[index];
              const name = getValidatorName(validator);

              return {
                key: validator.key,
                logo: providerDetails?.logo ?? validator.logoURI,
                name: providerDetails?.name ?? name,
              };
            })
          : [
              {
                key:
                  yieldDto.provider?.id ?? yieldDto.providerId ?? yieldDto.id,
                logo:
                  providersDetailsArr[0]?.logo ??
                  yieldDto.provider?.logoURI ??
                  undefined,
                name:
                  providersDetailsArr[0]?.name ??
                  yieldDto.provider?.name ??
                  yieldDto.providerId ??
                  yieldDto.metadata.name,
              },
            ];
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
          providers: strategyProviders,
          yieldType: getYieldTypeLabels(yieldDto, t).title,
        };
      })()
    : null;

  return (
    <Box data-rk="yield-rewards">
      <Box display="flex" flexDirection="column" gap="4" marginTop="3">
        {showYieldStrategyDetails && (
          <>
            {strategyDetails &&
            (dashboardVariant || strategyDetails.outputToken) ? (
              <YieldStrategyDetails {...strategyDetails} />
            ) : null}

            {dashboardVariant && <Divider />}
          </>
        )}

        {variant === "zerion" && rewardToken ? (
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
                      {rewardToken.symbols}
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
              {rewardToken.logoUri && (
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
                    src={rewardToken.logoUri}
                    fallbackName={rewardToken.providerName}
                  />

                  {isMorphoProvider(rewardToken.providerName) && (
                    <Box width="5" height="5">
                      <MorphoStarsIcon />
                    </Box>
                  )}
                </Box>
              )}
              <Text variant={{ type: "muted", weight: "normal" }}>
                {rewardToken.providerName}
              </Text>
            </Box>
          </Box>
        ) : null}

        <EstimatedRewardAmounts
          earnMonthly={earnMonthly}
          earnYearly={earnYearly}
        />

        {rewardRateDetails ? (
          <RewardRateBreakdown
            rewardRate={rewardRateDetails}
            showUpToCampaign
            title={t("details.apy_composition.title")}
            testId="reward-rate-breakdown"
          />
        ) : null}
      </Box>
    </Box>
  );
};

const YieldStrategyDetails = ({
  outputAmount,
  outputToken,
  providers,
  yieldType,
}: {
  outputAmount: string;
  outputToken: AppToken | null;
  providers: StrategyProvider[];
  yieldType: string;
}) => {
  const { t } = useTranslation();
  const firstProvider = providers[0];
  const providerName =
    firstProvider && providers.length > 1
      ? t("details.selected_validators_summary_other", {
          providerName: firstProvider.name,
        })
      : (firstProvider?.name ?? "");
  const displayedProviders = firstProvider ? [firstProvider] : [];

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

        {displayedProviders.map((provider) => (
          <Image
            key={provider.key}
            imgProps={{ borderRadius: "base", className: viaProviderImage }}
            wrapperProps={{ hw: "5" }}
            src={provider.logo}
            fallbackName={provider.name}
          />
        ))}

        <Text variant={{ type: "muted", weight: "normal" }}>
          {t("details.via", { providerName })}
        </Text>
      </Box>
    </Box>
  );
};

const getValidatorName = (validator: EarnValidator) =>
  validator.name ?? validator.address;
