import { useTranslation } from "react-i18next";
import { emptyBorrowPositions } from "../../../../../domain/borrow/positions/borrow-positions";
import { exactZero } from "../../../../../domain/finance/exact";
import { useWidgetConfig } from "../../../../../features/widget-configuration/index";
import { combineRecipeWithVariant } from "../../../../../shared/styles/recipe-variant";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { usePortfolioBorrowPositions } from "../../../react/use-borrow-positions";
import { useSummary } from "../../../react/use-summary";
import { SummaryItem } from "../../components/summary-item";
import { summaryContainer } from "../../components/summary-item/index.css";

export const Summary = () => {
  const summary = useSummary();
  const allPositions =
    summary.allPositions._tag === "Ready"
      ? summary.allPositions.value
      : undefined;
  const averageApy =
    summary.averageApy._tag === "Ready" ? summary.averageApy.value : undefined;
  const availableBalance =
    summary.availableBalance._tag === "Ready"
      ? summary.availableBalance.value
      : undefined;
  const borrowPositions = usePortfolioBorrowPositions();
  const borrowPositionsAreLoading =
    borrowPositions.enabled &&
    borrowPositions.connectionStatus === "connected" &&
    borrowPositions.positions._tag === "Loading";
  const hasBorrowPositions =
    borrowPositions.enabled &&
    borrowPositions.positions._tag === "Ready" &&
    borrowPositions.positions.value.length > 0;
  const borrowTotals =
    borrowPositions.totals._tag === "Ready"
      ? borrowPositions.totals.value
      : emptyBorrowPositions.totals;
  const borrowApySummary = {
    totalValue: borrowTotals.netApyWeightUsd,
    weightedApy: borrowTotals.netApy
      .multipliedBy(100)
      .multipliedBy(borrowTotals.netApyWeightUsd),
  };
  const totalPositionsValue = hasBorrowPositions
    ? (allPositions?.allPositionsSum ?? exactZero()).plus(
        borrowTotals.totalSuppliedUsd
      )
    : allPositions?.allPositionsSum;
  const averageApyValue = (() => {
    if (!hasBorrowPositions) {
      return averageApy;
    }

    const earnPositionsValue = allPositions?.allPositionsSum ?? exactZero();
    const totalValue = earnPositionsValue.plus(borrowApySummary.totalValue);

    if (!totalValue.gt(0)) {
      return exactZero();
    }

    const earnWeightedApy =
      averageApy?.times(earnPositionsValue) ?? exactZero();

    return earnWeightedApy.plus(borrowApySummary.weightedApy).div(totalValue);
  })();
  const availableOrNetWorthValue = hasBorrowPositions
    ? (allPositions?.allPositionsSum ?? exactZero()).plus(
        borrowTotals.netWorthUsd
      )
    : availableBalance;

  const { t } = useTranslation();

  const variant = useWidgetConfig("variant");

  return (
    <Box display="flex" flexDirection="column" gap="2">
      <Box
        className={combineRecipeWithVariant({ rec: summaryContainer, variant })}
      >
        <SummaryItem
          type="staked"
          label={t(
            hasBorrowPositions
              ? "dashboard.overview.summary.total_supplied"
              : "dashboard.overview.summary.total_staked"
          )}
          value={totalPositionsValue}
          isLoading={
            summary.allPositions._tag === "Loading" || borrowPositionsAreLoading
          }
        />

        <SummaryItem
          type="apy"
          label={t("dashboard.overview.summary.average_apy")}
          value={averageApyValue}
          isLoading={
            summary.averageApy._tag === "Loading" || borrowPositionsAreLoading
          }
        />

        <SummaryItem
          type="available"
          label={t(
            hasBorrowPositions
              ? "dashboard.overview.summary.net_worth"
              : "dashboard.overview.summary.available_balance"
          )}
          value={availableOrNetWorthValue}
          isLoading={
            hasBorrowPositions
              ? summary.allPositions._tag === "Loading" ||
                borrowPositionsAreLoading
              : summary.availableBalance._tag === "Loading"
          }
        />
      </Box>
      {allPositions?.excludesConfidential ? (
        <Text variant={{ type: "muted", weight: "normal", size: "small" }}>
          {t("dashboard.overview.summary.excludes_confidential")}
        </Text>
      ) : null}
    </Box>
  );
};
