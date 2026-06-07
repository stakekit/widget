import { Trigger } from "@radix-ui/react-dialog";
import BigNumber from "bignumber.js";
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
import { CaretDownIcon } from "../../../components/atoms/icons/caret-down";
import { Image } from "../../../components/atoms/image";
import { TokenIcon } from "../../../components/atoms/token-icon";
import { Text } from "../../../components/atoms/typography/text";
import { SelectValidator } from "../../../components/molecules/select-validator";
import {
  RiskRatingBadge,
  riskSummaryActions,
  YieldRiskInfoTooltip,
} from "../../../components/molecules/yield-risk";
import {
  getEffectiveYieldRewardRateDetails,
  type SelectedValidators,
} from "../../../domain/types/reward-rate";
import {
  getDashboardYieldCategory,
  getExtendedYieldType,
  getYieldActionArg,
  getYieldCooldownPeriod,
  getYieldRiskDisplay,
  getYieldRiskSourceLabel,
  isYieldActionArgRequired,
  isYieldValidatorSelectionRequired,
  type Yield,
} from "../../../domain/types/yields";
import { useSelectValidator } from "../../../pages/details/earn-page/components/select-validator-section/use-select-validator";
import { useEarnPageContext } from "../../../pages/details/earn-page/state/earn-page-context";
import { APToPercentage, formatAddress, formatNumber } from "../../../utils";
import {
  formatCompactNumber,
  formatCompactUsd,
  getRewardTypeFormatted,
} from "../../../utils/formatters";
import { HistoryChart } from "./reward-rate-chart";
import {
  addressBox,
  autoBadge,
  container,
  detailRow,
  externalLinkIcon,
  headerBadge,
  headerBadgeRow,
  headerProviderLabelText,
  headerProviderText,
  metricCard,
  metricGrid,
  metricLabelText,
  metricSubValueText,
  metricValueText,
  providerCard,
  providerCardContent,
  providerCardHeader,
  providerCardMainRow,
  providerChangeButton,
  providerMetaText,
  providerNameText,
  providerStatusText,
  providerWebsiteText,
  rangeButton,
  titleText,
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

type ProviderDetailsItem = NonNullable<
  ReturnType<
    ReturnType<typeof useEarnPageContext>["providersDetails"]["extractNullable"]
  >
>[number];

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

  const provider = yieldDto.provider;
  const risk = getYieldRiskDisplay(yieldDto);
  const addressRows = getAddressRows(yieldDto);
  const dashboardYieldCategory = getDashboardYieldCategory(yieldDto);
  const isStakeCategory = dashboardYieldCategory === "stake";
  const providerName = getSelectedProviderName({
    selectedValidators,
    yieldDto,
  });
  const effectiveRewardRate = getEffectiveYieldRewardRateDetails({
    selectedValidators,
    yieldDto,
  });
  const rewardRateFormatted = effectiveRewardRate
    ? `${APToPercentage(effectiveRewardRate.total)}%`
    : "-";
  const tvlFormatted = formatCompactUsd(yieldDto.statistics?.tvlUsd);
  const metricCards = getMetricCards({
    risk,
    rewardRateFormatted,
    t,
    tvlFormatted,
    yieldDto,
  });
  const headerBadges = getHeaderBadges(yieldDto, t);

  return (
    <Box className={container} display="flex" flexDirection="column" gap="4">
      <Box display="flex" alignItems="center" gap="3">
        <TokenIcon
          metadata={{
            logoURI: yieldDto.metadata.logoURI,
            name: yieldDto.metadata.name,
            provider: provider,
          }}
          token={yieldDto.token}
          tokenLogoHw="12"
        />

        <Box minWidth="0">
          <Text className={titleText} variant={{ weight: "bold" }}>
            {formatDetailsTitle({ providerName, yieldDto })}
          </Text>

          <Box className={headerBadgeRow}>
            <ProviderLabel providerName={providerName} yieldDto={yieldDto} />

            <Text
              className={headerProviderText}
              variant={{ type: "muted", weight: "normal" }}
            >
              {" · "}
              {formatNetworkName(yieldDto.network)}
              {" · "}
              {formatDisplayTokenSymbol(yieldDto)}
            </Text>

            {headerBadges.map((badge) => (
              <Box
                className={badge.tone === "auto" ? autoBadge : headerBadge}
                key={badge.label}
              >
                <Text variant={{ weight: "bold", size: "small" }}>
                  {badge.label}
                </Text>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      <Box className={metricGrid}>
        {metricCards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </Box>

      <ProviderSelectionCard />

      {shouldRenderHistoryChart(rewardRateHistory) && (
        <HistoryChartSection
          chartId="reward-rate"
          history={rewardRateHistory}
          onPeriodChange={setRewardRatePeriod}
          period={rewardRatePeriod}
          tickFormatter={(value) => `${formatNumber(value, 2)}%`}
          title={t("dashboard.earn_details.reward_rate")}
          value={rewardRateFormatted}
        />
      )}

      {!isStakeCategory && shouldRenderHistoryChart(tvlHistory) && (
        <HistoryChartSection
          chartId="tvl"
          history={tvlHistory}
          onPeriodChange={setTvlPeriod}
          period={tvlPeriod}
          tickFormatter={formatCompactUsd}
          title={t("dashboard.earn_details.tvl")}
          value={tvlFormatted}
        />
      )}

      <DetailsSection title={t("dashboard.earn_details.about")}>
        <Text variant={{ type: "muted", weight: "normal" }}>
          {yieldDto.metadata.description}
        </Text>
      </DetailsSection>

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

const ProviderLabel = ({
  providerName,
  yieldDto,
}: {
  providerName: string;
  yieldDto: Yield;
}) => {
  const { t } = useTranslation();

  return (
    <Box display="flex" alignItems="center" gap="1" flexShrink={0}>
      <Image
        wrapperProps={{ hw: "5" }}
        imgProps={{ borderRadius: "base" }}
        src={yieldDto.provider?.logoURI}
        fallbackName={providerName}
      />
      <Text className={headerProviderLabelText} variant={{ weight: "normal" }}>
        {t("positions.via", { providerName, count: 1 })}
      </Text>
    </Box>
  );
};

const ProviderSelectionCard = () => {
  const {
    hasMoreValidators,
    isLoading,
    isLoadingMoreValidators,
    onClose,
    onItemClick,
    onLoadMoreValidators,
    onOpen,
    onValidatorSearch,
    onViewMoreClick,
    selectedStake,
    selectedValidators,
    validatorSearch,
    validatorsData,
  } = useSelectValidator();
  const { providersDetails } = useEarnPageContext();
  const { t } = useTranslation();

  const yieldDto = selectedStake.extractNullable();

  if (!yieldDto || !isYieldValidatorSelectionRequired(yieldDto)) return null;

  const selectedValidatorsArr = [...selectedValidators.values()];
  const selectedProvider = providersDetails.extractNullable()?.[0];
  const providerName =
    selectedProvider?.name ??
    selectedValidatorsArr[0]?.name ??
    selectedValidatorsArr[0]?.address ??
    yieldDto.provider?.name ??
    yieldDto.providerId;
  const multiSelect = isYieldActionArgRequired(
    yieldDto,
    "enter",
    "validatorAddresses"
  );
  const validators = validatorsData.orDefault([]);

  return (
    <SelectValidator
      trigger={
        <Box className={providerCard}>
          <Box className={providerCardMainRow}>
            <Image
              wrapperProps={{ hw: "8", flexShrink: 0 }}
              imgProps={{ borderRadius: "base" }}
              src={selectedProvider?.logo}
              fallbackName={providerName}
            />

            <Box className={providerCardContent}>
              <Box className={providerCardHeader}>
                <Text className={providerNameText} variant={{ weight: "bold" }}>
                  {providerName}
                </Text>

                {selectedProvider?.preferred ? (
                  <Box className={autoBadge}>
                    <Text variant={{ weight: "bold", size: "small" }}>
                      {t("details.validators_preferred")}
                    </Text>
                  </Box>
                ) : null}
              </Box>

              <ProviderMetaLine
                provider={selectedProvider}
                tokenSymbol={yieldDto.token.symbol}
              />
            </Box>

            <Trigger asChild>
              <Box as="button" className={providerChangeButton} type="button">
                <Text variant={{ weight: "bold", size: "small" }}>
                  {t("shared.change")}
                </Text>
                <CaretDownIcon />
              </Box>
            </Trigger>
          </Box>

          {selectedProvider?.website ? (
            <Text
              as="a"
              className={providerWebsiteText}
              href={formatProviderWebsiteHref(selectedProvider.website)}
              rel="noreferrer"
              target="_blank"
              variant={{ type: "muted", weight: "normal" }}
            >
              {formatProviderWebsite(selectedProvider.website)}
              <ExternalLinkIcon />
            </Text>
          ) : null}
        </Box>
      }
      selectedValidators={new Set(selectedValidatorsArr.map((v) => v.address))}
      multiSelect={multiSelect}
      selectedStake={yieldDto}
      onItemClick={onItemClick}
      onViewMoreClick={onViewMoreClick}
      onClose={onClose}
      onOpen={onOpen}
      onSearch={onValidatorSearch}
      searchValue={validatorSearch}
      isLoading={isLoading}
      validators={validators}
      hasMore={hasMoreValidators}
      isLoadingMore={isLoadingMoreValidators}
      onLoadMore={onLoadMoreValidators}
    />
  );
};

const ProviderMetaLine = ({
  provider,
  tokenSymbol,
}: {
  provider: ProviderDetailsItem | undefined;
  tokenSymbol: string;
}) => {
  const details = [
    formatCommission(provider?.commission),
    formatProviderTvl(provider?.stakedBalance, tokenSymbol),
    provider?.status ? formatProviderStatus(provider.status) : null,
  ].filter((item): item is string => !!item);

  if (!details.length) return null;

  return (
    <Text
      className={providerMetaText}
      variant={{ type: "muted", weight: "normal" }}
    >
      {details.map((detail, index) => (
        <Box
          as="span"
          className={
            detail.toLowerCase() === "active" ? providerStatusText : undefined
          }
          key={detail}
        >
          {index > 0 ? "• " : ""}
          {detail}
        </Box>
      ))}
    </Text>
  );
};

const ExternalLinkIcon = () => (
  <svg
    aria-hidden="true"
    className={externalLinkIcon}
    fill="none"
    height="14"
    viewBox="0 0 14 14"
    width="14"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M5.25 3.5H3.5C2.5335 3.5 1.75 4.2835 1.75 5.25V10.5C1.75 11.4665 2.5335 12.25 3.5 12.25H8.75C9.7165 12.25 10.5 11.4665 10.5 10.5V8.75"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
    <path
      d="M8.75 1.75H12.25V5.25"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
    <path
      d="M6.41699 7.58333L12.2503 1.75"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
  </svg>
);

const shouldRenderHistoryChart = (history: {
  data: RewardRateHistoryPoint[];
  isError: boolean;
  isLoading: boolean;
}) => !history.isError && (history.isLoading || history.data.length >= 2);

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

type MetricCardProps = {
  label: string;
  subValue?: string;
  value: ReactNode;
};

const MetricCard = ({ label, subValue, value }: MetricCardProps) => (
  <Box className={metricCard} display="flex" flexDirection="column" gap="1">
    <Text
      className={metricLabelText}
      variant={{ type: "muted", weight: "normal" }}
    >
      {label}
    </Text>
    {typeof value === "string" ? (
      <Text className={metricValueText} variant={{ weight: "bold" }}>
        {value}
      </Text>
    ) : (
      <Box>{value}</Box>
    )}
    {subValue && (
      <Text
        className={metricSubValueText}
        variant={{ type: "muted", weight: "normal" }}
      >
        {subValue}
      </Text>
    )}
  </Box>
);

const getMetricCards = ({
  risk,
  rewardRateFormatted,
  t,
  tvlFormatted,
  yieldDto,
}: {
  risk: ReturnType<typeof getYieldRiskDisplay>;
  rewardRateFormatted: string;
  t: TFunction;
  tvlFormatted: string;
  yieldDto: Yield;
}): MetricCardProps[] => {
  const category = getDashboardYieldCategory(yieldDto);
  const rewardRateCard = {
    label: formatRewardRateLabel(yieldDto, t),
    value: rewardRateFormatted,
  };

  if (category === "stake") {
    return [
      rewardRateCard,
      {
        label: t("dashboard.earn_details.min_stake"),
        value: formatMinStake(yieldDto),
      },
      {
        label: t("dashboard.earn_details.cooldown"),
        value: formatCooldown(yieldDto, t),
      },
    ];
  }

  if (category === "rwa") {
    return [
      rewardRateCard,
      {
        label: t("dashboard.earn_details.tvl"),
        value: tvlFormatted,
      },
      {
        label: t("dashboard.earn_details.status"),
        subValue: formatNetworkName(yieldDto.network).toUpperCase(),
        value: formatRequirementStatus(yieldDto, t),
      },
    ];
  }

  return [
    rewardRateCard,
    {
      label: t("dashboard.earn_details.tvl"),
      value: tvlFormatted,
    },
    {
      label: t("dashboard.earn_details.risk"),
      subValue: risk
        ? getYieldRiskSourceLabel(risk.source, t).toUpperCase()
        : "-",
      value: risk ? (
        <Box className={riskSummaryActions}>
          <RiskRatingBadge risk={risk} />
          <YieldRiskInfoTooltip />
        </Box>
      ) : (
        "-"
      ),
    },
  ];
};

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

const getSelectedProviderName = ({
  selectedValidators,
  yieldDto,
}: {
  selectedValidators?: SelectedValidators | null;
  yieldDto: Yield;
}) => {
  const [selectedValidator] = selectedValidators
    ? [...selectedValidators.values()]
    : [];

  return (
    selectedValidator?.name ??
    selectedValidator?.address ??
    yieldDto.provider?.name ??
    yieldDto.providerId
  );
};

const formatDetailsTitle = ({
  providerName,
  yieldDto,
}: {
  providerName: string;
  yieldDto: Yield;
}) => {
  const name = yieldDto.metadata.name;

  if (
    getDashboardYieldCategory(yieldDto) !== "stake" ||
    name.toLowerCase().includes(providerName.toLowerCase())
  ) {
    return name;
  }

  return `${name} via ${providerName}`;
};

const formatDisplayTokenSymbol = (yieldDto: Yield) =>
  yieldDto.outputToken?.symbol ?? yieldDto.token.symbol;

const getHeaderBadges = (yieldDto: Yield, t: TFunction) => {
  const yieldType = getExtendedYieldType(yieldDto);
  const badges: { label: string; tone: "default" | "auto" }[] = [];

  if (yieldType === "native_staking") {
    badges.push({
      label: t("dashboard.earn_details.native"),
      tone: "default",
    });
  }

  if (yieldType === "pooled_staking") {
    badges.push({
      label: t("dashboard.earn_details.pooled"),
      tone: "default",
    });
  }

  if (yieldType === "restaking") {
    badges.push({
      label: t("yield_types.restaking.title"),
      tone: "default",
    });
  }

  if (yieldDto.mechanics.requirements?.kycRequired) {
    badges.push({
      label: t("dashboard.earn_details.kyc"),
      tone: "default",
    });
  }

  if (
    getDashboardYieldCategory(yieldDto) === "stake" &&
    yieldDto.mechanics.rewardClaiming === "auto"
  ) {
    badges.push({
      label: t("dashboard.earn_details.auto_compound"),
      tone: "auto",
    });
  }

  return badges;
};

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

const formatRewardRateLabel = (yieldDto: Yield, t: TFunction) => {
  const rewardType =
    getRewardTypeFormatted(yieldDto.rewardRate.rateType.toLowerCase()) ||
    t("dashboard.earn_details.apy");

  return getDashboardYieldCategory(yieldDto) === "stake"
    ? rewardType
    : t("dashboard.earn_details.reward_rate_period", {
        rewardType,
      });
};

const formatMinStake = (yieldDto: Yield) => {
  const minimum =
    yieldDto.mechanics.entryLimits?.minimum ??
    getYieldActionArg(yieldDto, "enter", "amount")?.minimum;

  if (minimum === null || minimum === undefined) return "-";

  const amount = BigNumber(minimum);

  if (!amount.isFinite()) return "-";

  return `${formatNumber(amount, amount.isInteger() ? 0 : 6)} ${
    yieldDto.token.symbol
  }`;
};

const formatRequirementStatus = (yieldDto: Yield, t: TFunction) =>
  yieldDto.mechanics.requirements?.kycRequired
    ? t("dashboard.earn_details.kyc")
    : t("dashboard.earn_details.active");

const formatCommission = (commission: ProviderDetailsItem["commission"]) => {
  if (commission === null || commission === undefined) return null;

  const amount = BigNumber(commission);

  return amount.isFinite()
    ? `Commission ${amount.multipliedBy(100).toFixed(2)}%`
    : null;
};

const formatProviderTvl = (
  tvl: ProviderDetailsItem["stakedBalance"],
  tokenSymbol: string
) => {
  if (tvl === null || tvl === undefined) return null;

  const formatted = formatCompactNumber(tvl);

  return formatted === "-" ? null : `TVL ${formatted} ${tokenSymbol}`;
};

const formatProviderStatus = (status: ProviderDetailsItem["status"]) => {
  if (!status) return null;

  return status.charAt(0).toUpperCase() + status.slice(1);
};

const formatProviderWebsite = (website: string) => {
  try {
    return new URL(website).hostname.replace(/^www\./, "");
  } catch {
    return website.replace(/^https?:\/\/(www\.)?/, "");
  }
};

const formatProviderWebsiteHref = (website: string) =>
  /^https?:\/\//i.test(website) ? website : `https://${website}`;

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
