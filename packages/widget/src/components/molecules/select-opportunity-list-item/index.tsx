import { Array as EArray, pipe } from "effect";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import {
  getRewardRateBreakdown,
  getYieldRewardRateDetails,
} from "../../../domain/types/reward-rate";
import {
  getYieldFeePercent,
  getYieldProviderDetails,
  getYieldRewardTokens,
  getYieldRiskDisplay,
  getYieldTvlUsd,
  type Yield,
} from "../../../domain/types/yields";
import { APToPercentage, formatNumber } from "../../../utils";
import {
  formatCompactUsd,
  getRewardRateFormatted,
} from "../../../utils/formatters";
import { Box } from "../../atoms/box";
import { SelectModalItem } from "../../atoms/select-modal";
import { ProviderIcon } from "../../atoms/token-icon/provider-icon";
import { Text } from "../../atoms/typography/text";
import { RiskRatingBadge } from "../yield-risk";
import { rewardRateText, selectItemText } from "./styles.css";

const getYieldTvlLabel = (item: Yield) => {
  const tvlUsd = getYieldTvlUsd(item);

  if (tvlUsd) {
    const formatted = formatCompactUsd(tvlUsd);

    if (formatted !== "-") {
      return `TVL: ${formatted}`;
    }
  }

  return null;
};

const getDistinctRewardTokensBySymbol = (item: Yield) =>
  EArray.dedupeWith(
    getYieldRewardTokens(item),
    (a, b) => a.symbol === b.symbol
  );

export const SelectOpportunityListItem = ({
  item,
  onYieldSelect,
  testId,
}: {
  item: Yield;
  onYieldSelect: (item: Yield) => void;
  testId?: string;
}) => {
  const onItemClick: ComponentProps<typeof SelectModalItem>["onItemClick"] = ({
    closeModal,
  }) => {
    onYieldSelect(item);
    closeModal();
  };

  const { t } = useTranslation();

  const campaignRate = getRewardRateBreakdown(
    getYieldRewardRateDetails(item)
  ).find((rewardRate) => rewardRate.key === "campaign");

  const totalRateFormatted = getRewardRateFormatted({
    rewardRate: item.rewardRate.total,
  });

  const primaryRateFormatted = getRewardRateFormatted({
    rewardRate: campaignRate
      ? item.rewardRate.total - campaignRate.rate
      : item.rewardRate.total,
  });

  const provider = getYieldProviderDetails(item) ?? undefined;
  const rewardTokenSymbols = pipe(
    getDistinctRewardTokensBySymbol(item),
    EArray.map((token) => token.symbol),
    EArray.join(", ")
  );

  const tvlLabel = getYieldTvlLabel(item);
  const feePercent = getYieldFeePercent(item);
  const risk = getYieldRiskDisplay(item);

  return (
    <SelectModalItem testId={testId} onItemClick={onItemClick}>
      <ProviderIcon
        metadata={{
          logoURI: item.metadata.logoURI,
          name: item.metadata.name,
          provider,
        }}
        token={item.token as Parameters<typeof ProviderIcon>[0]["token"]}
      />

      <Box
        display="flex"
        flexDirection="column"
        flex={1}
        marginLeft="2"
        minWidth="0"
      >
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          gap="2"
        >
          <Box>
            <Text className={selectItemText} variant={{ weight: "bold" }}>
              {item.metadata.name}
            </Text>
          </Box>

          <Box textAlign="end">
            <Text className={rewardRateText}>{primaryRateFormatted}</Text>

            {campaignRate ? (
              <Text variant={{ type: "muted", weight: "normal" }}>
                {t("details.apy_composition.up_to", {
                  value: totalRateFormatted,
                })}
              </Text>
            ) : null}
          </Box>
        </Box>

        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" marginTop="1" flexWrap="wrap" gap="1">
            {!!tvlLabel && <Text variant={{ type: "muted" }}>{tvlLabel}</Text>}

            {!!rewardTokenSymbols && (
              <Text variant={{ type: "muted" }}>{rewardTokenSymbols}</Text>
            )}

            {!rewardTokenSymbols && (
              <Box
                background="background"
                borderRadius="2xl"
                px="2"
                display="flex"
                alignItems="center"
              >
                <Text variant={{ type: "muted" }}>{item.token.symbol}</Text>
              </Box>
            )}

            {risk ? (
              <RiskRatingBadge
                risk={risk}
                testId={testId ? `risk-rating__${testId}` : undefined}
              />
            ) : null}
          </Box>

          {feePercent != null ? (
            <Text
              variant={{ type: "muted" }}
            >{`${t("shared.fee")}: ${formatNumber(APToPercentage(feePercent), 2)}%`}</Text>
          ) : null}
        </Box>
      </Box>
    </SelectModalItem>
  );
};
