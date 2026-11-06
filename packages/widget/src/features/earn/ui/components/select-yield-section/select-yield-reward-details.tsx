import { Trans, useTranslation } from "react-i18next";

import type { EarnValidator } from "../../../../../domain/earn/models";
import { getEffectiveYieldRewardRateDetails } from "../../../../../domain/earn/reward-rate";
import {
  getYieldOutputToken,
  getYieldTypeLabels,
} from "../../../../../domain/earn/yield";
import type { Token } from "../../../../../domain/token/token";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import {
  Avatar,
  Divider,
  MorphoMark,
  Stack,
  Text,
} from "../../../../../ui/index";
import { useWidgetConfig } from "../../../../widget-configuration/index";
import {
  EstimatedRewardAmounts,
  getRewardTokenSymbols,
  isMorphoProvider,
  RewardRateBreakdown,
} from "../../../../yield-summary/views";
import { useEarnEntry } from "../../../react/use-earn-facades";
import { formatEntryFigure, formatEstimatedRewards } from "./entry-figure";

type StrategyProvider = {
  key: string;
  logo: string | undefined;
  name: string;
  /** Validators' marks are rounded squares; a provider's is round. */
  shape: "round" | "square";
};

export const SelectYieldRewardDetails = ({
  alwaysShowStrategy,
}: {
  readonly alwaysShowStrategy: boolean;
}) => {
  const { earnPresentation } = useWidgetConfig("hostProfile");
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const showYieldStrategyDetails = !earnPresentation.zerion;

  const { view } = useEarnEntry();
  const {
    amountEntered,
    priceUsd,
    rewardToken,
    estimatedRewards,
    rewardsTokenSymbol,
    selectedStake,
    selectedValidators,
    stakeAmount,
    providers: providersDetails,
  } = view;

  const rewardRateDetails = selectedStake
    ? getEffectiveYieldRewardRateDetails({
        selectedValidators,
        yieldDto: selectedStake,
      })
    : null;

  const estimatedRewardFigures = formatEstimatedRewards({
    amountEntered,
    amountUsd: priceUsd,
    estimatedRewards,
    locale,
    unit: rewardsTokenSymbol,
  });
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
                shape: "square",
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
                shape: "round" as const,
              },
            ];
        const pricePerShare = yieldDto.state?.pricePerShareState?.price;
        const outputAmount =
          pricePerShare && !pricePerShare.isZero()
            ? stakeAmount.dividedBy(pricePerShare)
            : stakeAmount;
        // Before an amount is entered, the token alone says what it gives.
        const getOutputFigure = () => {
          if (!outputToken) return null;
          if (!amountEntered) return outputToken.symbol;
          return formatEntryFigure({
            amount: outputAmount,
            amountEntered,
            locale,
            unit: outputToken.symbol,
          });
        };

        return {
          outputAmount: getOutputFigure(),
          outputToken,
          providers: strategyProviders,
          yieldType: getYieldTypeLabels(yieldDto, t).title,
        };
      })()
    : null;

  return (
    <Stack gap={16}>
      {showYieldStrategyDetails && (
        <>
          {strategyDetails &&
          (alwaysShowStrategy || strategyDetails.outputToken) ? (
            <YieldStrategyDetails {...strategyDetails} />
          ) : null}

          {alwaysShowStrategy && <Divider />}
        </>
      )}

      {earnPresentation.zerion && rewardToken ? (
        <Stack direction="row" align="center" justify="between" gap={8}>
          <Text tone="muted">
            <Trans
              i18nKey="details.rewards.receive"
              components={{
                symbols1: (
                  <Text.Strong>
                    {getRewardTokenSymbols(rewardToken.rewardTokens)}
                  </Text.Strong>
                ),
              }}
            />
          </Text>

          <Stack direction="row" align="center" gap={4}>
            {rewardToken.logoUri && (
              <Avatar
                src={rewardToken.logoUri}
                fallback={rewardToken.providerName}
                size="xs"
              />
            )}
            {isMorphoProvider(rewardToken.providerName) && <MorphoMark />}
            <Text tone="muted">{rewardToken.providerName}</Text>
          </Stack>
        </Stack>
      ) : null}

      <EstimatedRewardAmounts figures={estimatedRewardFigures} />

      {rewardRateDetails ? (
        <RewardRateBreakdown
          rewardRate={rewardRateDetails}
          showUpToCampaign
          title={t("details.apy_composition.title")}
          testId="reward-rate-breakdown"
        />
      ) : null}
    </Stack>
  );
};

const YieldStrategyDetails = ({
  outputAmount,
  outputToken,
  providers,
  yieldType,
}: {
  outputAmount: string | null;
  outputToken: Token | null;
  providers: ReadonlyArray<StrategyProvider>;
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
    <Stack direction="row" align="center" justify="between" gap={8} wrap>
      {outputToken ? (
        <Text tone="muted">
          {t("details.rewards.receive_output")}{" "}
          <Text.Strong>{outputAmount}</Text.Strong>
        </Text>
      ) : (
        <Text tone="muted">{t("details.yield_strategy")}</Text>
      )}

      <Stack direction="row" align="center" gap={4}>
        {!outputToken && <Text tone="muted">{yieldType}</Text>}

        {displayedProviders.map((provider) => (
          <Avatar
            key={provider.key}
            src={provider.logo}
            fallback={provider.name}
            size="xs"
            shape={provider.shape}
          />
        ))}

        <Text tone="muted">{t("details.via", { providerName })}</Text>
      </Stack>
    </Stack>
  );
};

const getValidatorName = (validator: EarnValidator) =>
  validator.name ?? validator.address;
