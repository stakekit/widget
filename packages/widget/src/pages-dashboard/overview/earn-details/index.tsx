import type { TFunction } from "i18next";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box } from "../../../components/atoms/box";
import {
  CollapsibleArrow,
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
} from "../../../components/atoms/collapsible";
import { ContentLoaderSquare } from "../../../components/atoms/content-loader";
import { TokenIcon } from "../../../components/atoms/token-icon";
import { Text } from "../../../components/atoms/typography/text";
import { RiskRatingBadge } from "../../../components/molecules/yield-risk";
import {
  getEffectiveYieldRewardRateDetails,
  type SelectedValidators,
} from "../../../domain/types/reward-rate";
import {
  getYieldCooldownPeriod,
  getYieldProviderDetails,
  getYieldRiskDisplay,
  getYieldRiskSourceLabel,
  type Yield,
} from "../../../domain/types/yields";
import { useEarnPageContext } from "../../../pages/details/earn-page/state/earn-page-context";
import { APToPercentage, formatAddress, formatNumber } from "../../../utils";
import { formatCompactUsd } from "../../../utils/formatters";
import { HistoryChart } from "./reward-rate-chart";
import {
  addressBox,
  container,
  detailRow,
  headerProviderText,
  metricCard,
  metricGrid,
  rangeButton,
  sectionDivider,
  valueText,
} from "./styles.css";
import {
  type RewardRateHistoryPeriod,
  type RewardRateHistoryPoint,
  useYieldRewardRateHistory,
} from "./use-yield-reward-rate-history";
import { useYieldTvlHistory } from "./use-yield-tvl-history";

const periods = [
  ["30d", "1M"],
  ["90d", "3M"],
  ["1y", "1Y"],
  ["all", "ALL"],
] as const satisfies ReadonlyArray<readonly [RewardRateHistoryPeriod, string]>;

export const EarnDetails = () => {
  const {
    appLoading,
    selectedStake,
    selectedValidators,
    selectYieldIsLoading,
  } = useEarnPageContext();

  return (
    <EarnDetailsView
      isLoading={appLoading || selectYieldIsLoading}
      selectedValidators={selectedValidators}
      yieldDto={selectedStake.extractNullable()}
    />
  );
};

export const EarnDetailsView = ({
  isLoading,
  selectedValidators,
  yieldDto,
}: {
  isLoading: boolean;
  selectedValidators?: SelectedValidators | null;
  yieldDto: Yield | null;
}) => {
  const [rewardRatePeriod, setRewardRatePeriod] =
    useState<RewardRateHistoryPeriod>("90d");
  const [tvlPeriod, setTvlPeriod] = useState<RewardRateHistoryPeriod>("90d");
  const { t } = useTranslation();

  const rewardRateHistory = useYieldRewardRateHistory({
    period: rewardRatePeriod,
    yieldId: yieldDto?.id,
  });
  const tvlHistory = useYieldTvlHistory({
    period: tvlPeriod,
    yieldId: yieldDto?.id,
  });

  if (isLoading) {
    return <ContentLoaderSquare heightPx={430} />;
  }

  if (!yieldDto) {
    return (
      <Box
        alignItems="center"
        className={container}
        display="flex"
        justifyContent="center"
      >
        <Text variant={{ type: "muted", weight: "normal" }}>
          {t("dashboard.earn_details.empty")}
        </Text>
      </Box>
    );
  }

  const provider = getYieldProviderDetails(yieldDto);
  const risk = getYieldRiskDisplay(yieldDto);
  const addressRows = getAddressRows(yieldDto);
  const effectiveRewardRate = getEffectiveYieldRewardRateDetails({
    selectedValidators,
    yieldDto,
  });
  const rewardRateFormatted = effectiveRewardRate
    ? `${APToPercentage(effectiveRewardRate.total)}%`
    : "-";
  const tvlFormatted = formatCompactUsd(yieldDto.statistics?.tvlUsd);

  return (
    <Box className={container} display="flex" flexDirection="column" gap="4">
      <Box display="flex" alignItems="center" gap="3">
        <TokenIcon
          metadata={{
            logoURI: yieldDto.metadata.logoURI,
            name: yieldDto.metadata.name,
            provider: provider ?? undefined,
          }}
          token={yieldDto.token}
        />

        <Box minWidth="0">
          <Text variant={{ weight: "bold" }}>{yieldDto.metadata.name}</Text>
          <Text
            className={headerProviderText}
            variant={{ type: "muted", weight: "normal" }}
          >
            {t("positions.via", {
              providerName: provider?.name ?? yieldDto.providerId,
              count: 1,
            })}
            {" · "}
            {formatNetworkName(yieldDto.network)}
            {" · "}
            {yieldDto.token.symbol}
          </Text>
        </Box>
      </Box>

      <Box className={metricGrid}>
        <MetricCard
          label={t("dashboard.earn_details.apy")}
          value={rewardRateFormatted}
        />
        <MetricCard
          label={t("dashboard.earn_details.tvl")}
          value={tvlFormatted}
        />
        <MetricCard
          label={t("dashboard.earn_details.risk")}
          subValue={
            risk ? getYieldRiskSourceLabel(risk.source, t).toUpperCase() : "-"
          }
          value={risk ? <RiskRatingBadge risk={risk} /> : "-"}
        />
      </Box>

      <HistoryChartSection
        chartId="reward-rate"
        history={rewardRateHistory}
        onPeriodChange={setRewardRatePeriod}
        period={rewardRatePeriod}
        tickFormatter={(value) => `${formatNumber(value, 2)}%`}
        title={t("dashboard.earn_details.reward_rate")}
        value={rewardRateFormatted}
      />

      <HistoryChartSection
        chartId="tvl"
        history={tvlHistory}
        onPeriodChange={setTvlPeriod}
        period={tvlPeriod}
        tickFormatter={formatCompactUsd}
        title={t("dashboard.earn_details.tvl")}
        value={tvlFormatted}
      />

      <Box className={sectionDivider} />

      <DetailsSection title={t("dashboard.earn_details.about")}>
        <Text variant={{ type: "muted", weight: "normal" }}>
          {yieldDto.metadata.description}
        </Text>
      </DetailsSection>

      <Box className={sectionDivider} />

      <DetailsSection title={t("dashboard.earn_details.details")}>
        <DetailRow
          label={t("dashboard.earn_details.network")}
          value={formatNetworkName(yieldDto.network)}
        />
        <DetailRow
          label={t("dashboard.earn_details.provider")}
          value={provider?.name ?? yieldDto.providerId}
        />
        <DetailRow
          label={t("dashboard.earn_details.reward_token")}
          value={formatRewardTokenLabel(yieldDto)}
        />
        <DetailRow
          label={t("dashboard.earn_details.cooldown")}
          value={formatCooldown(yieldDto, t)}
        />
        <DetailRow
          label={t("dashboard.earn_details.reward_claiming")}
          value={formatRewardClaiming(yieldDto, t)}
        />

        {addressRows.length > 0 && (
          <Box display="flex" flexDirection="column" gap="2" marginTop="2">
            {addressRows.map((row) => (
              <AddressRow key={`${row.label}-${row.address}`} {...row} />
            ))}
          </Box>
        )}
      </DetailsSection>
    </Box>
  );
};

const HistoryChartSection = ({
  chartId,
  history,
  onPeriodChange,
  period,
  tickFormatter,
  title,
  value,
}: {
  chartId: string;
  history: {
    data: RewardRateHistoryPoint[];
    isFetching: boolean;
    isLoading: boolean;
  };
  onPeriodChange: (period: RewardRateHistoryPeriod) => void;
  period: RewardRateHistoryPeriod;
  tickFormatter: (value: number) => string;
  title: string;
  value: string;
}) => (
  <Box>
    <Box display="flex" justifyContent="space-between" alignItems="center">
      <Text variant={{ weight: "normal" }}>
        {title}{" "}
        <Box as="span" fontWeight="bold">
          {value}
        </Box>
      </Text>

      <Box display="flex" gap="1">
        {periods.map(([value, label]) => (
          <Box
            as="button"
            className={rangeButton({ active: period === value })}
            key={value}
            onClick={() => onPeriodChange(value)}
            type="button"
          >
            <Text variant={{ type: "muted", weight: "normal" }}>{label}</Text>
          </Box>
        ))}
      </Box>
    </Box>

    <HistoryChart
      chartId={chartId}
      data={history.data}
      isFetching={history.isFetching}
      isLoading={history.isLoading}
      tickFormatter={tickFormatter}
    />
  </Box>
);

const MetricCard = ({
  label,
  subValue,
  value,
}: {
  label: string;
  subValue?: string;
  value: ReactNode;
}) => (
  <Box className={metricCard} display="flex" flexDirection="column" gap="1">
    <Text variant={{ type: "muted", weight: "normal" }}>{label}</Text>
    <Text variant={{ weight: "bold", size: "large" }}>{value}</Text>
    {subValue && (
      <Text variant={{ type: "muted", weight: "normal", size: "small" }}>
        {subValue}
      </Text>
    )}
  </Box>
);

const DetailsSection = ({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) => (
  <CollapsibleRoot initial={false}>
    <Box display="flex" flexDirection="column">
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        paddingBottom="3"
      >
        <Text variant={{ weight: "bold" }}>{title}</Text>
        <CollapsibleTrigger flex={1} justifyContent="flex-end">
          <CollapsibleArrow />
        </CollapsibleTrigger>
      </Box>

      <CollapsibleContent>{children}</CollapsibleContent>
    </Box>
  </CollapsibleRoot>
);

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <Box className={detailRow}>
    <Text variant={{ type: "muted", weight: "normal" }}>{label}</Text>
    <Text className={valueText} variant={{ weight: "normal" }}>
      {value}
    </Text>
  </Box>
);

const AddressRow = ({ address, label }: { address: string; label: string }) => (
  <Box className={addressBox}>
    <Text variant={{ type: "muted", weight: "normal" }}>{label}</Text>
    <Text className={valueText} variant={{ weight: "normal" }}>
      {formatAddress(address)}
    </Text>
  </Box>
);

const getAddressRows = (yieldDto: Yield) =>
  [
    yieldDto.outputToken?.address
      ? {
          label: "Vault",
          address: yieldDto.outputToken.address,
        }
      : null,
    yieldDto.token.address
      ? {
          label: `Asset (${yieldDto.token.symbol})`,
          address: yieldDto.token.address,
        }
      : null,
  ].filter((row): row is { label: string; address: string } => !!row);

const formatNetworkName = (network: string) =>
  network
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatRewardTokenLabel = (yieldDto: Yield) => {
  const symbol = yieldDto.token.symbol;

  return yieldDto.mechanics.rewardClaiming === "auto"
    ? `${symbol} (PPS-bearing)`
    : symbol;
};

const formatCooldown = (yieldDto: Yield, t: TFunction) => {
  const days = getYieldCooldownPeriod(yieldDto)?.days ?? 0;

  return days > 0
    ? t("dashboard.earn_details.cooldown_days", { count: days })
    : t("dashboard.earn_details.none");
};

const formatRewardClaiming = (
  yieldDto: Yield,
  t: ReturnType<typeof useTranslation>["t"]
) =>
  yieldDto.mechanics.rewardClaiming === "auto"
    ? t("dashboard.earn_details.auto_compounding")
    : t("dashboard.earn_details.manual");
