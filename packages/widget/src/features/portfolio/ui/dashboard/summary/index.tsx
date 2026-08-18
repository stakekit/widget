import BigNumber from "bignumber.js";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../../features/widget-configuration/index";
import { combineRecipeWithVariant } from "../../../../../shared/styles/recipe-variant";
import { Box } from "../../../../../shared/ui/primitives/box";
import { usePortfolioBorrowPositions } from "../../../react/use-borrow-positions";
import { useSummary } from "../../../react/use-summary";
import { SummaryItem } from "../../components/summary-item";
import { summaryContainer } from "../../components/summary-item/index.css";

export const Summary = () => {
  const { allPositionsResult, averageApyResult, availableBalanceResult } =
    useSummary();
  const allPositions = allPositionsResult.pipe(
    AsyncResult.value,
    Option.getOrUndefined
  );
  const averageApy = averageApyResult.pipe(
    AsyncResult.value,
    Option.getOrUndefined
  );
  const availableBalance = availableBalanceResult.pipe(
    AsyncResult.value,
    Option.getOrUndefined
  );
  const borrowPositions = usePortfolioBorrowPositions();
  const borrowPositionItems = AsyncResult.getOrElse(
    borrowPositions.positionsResult,
    () => []
  );
  const borrowPositionsAreLoading =
    borrowPositions.enabled &&
    borrowPositions.connectionStatus === "connected" &&
    (AsyncResult.isInitial(borrowPositions.positionsResult) ||
      AsyncResult.isWaiting(borrowPositions.positionsResult));
  const hasBorrowPositions =
    borrowPositions.enabled && borrowPositionItems.length > 0;
  const borrowTotalSupplied = borrowPositionItems.reduce(
    (acc, position) => acc.plus(position.metrics.totalSuppliedUsd),
    new BigNumber(0)
  );
  const borrowNetWorth = borrowPositionItems.reduce(
    (acc, position) => acc.plus(position.metrics.netWorthUsd),
    new BigNumber(0)
  );
  const borrowApySummary = borrowPositionItems.reduce(
    (acc, position) => {
      const netWorth = position.metrics.netWorthUsd;

      if (netWorth <= 0) {
        return acc;
      }

      return {
        totalValue: acc.totalValue.plus(netWorth),
        weightedApy: acc.weightedApy.plus(
          position.metrics.netApy * 100 * netWorth
        ),
      };
    },
    {
      totalValue: new BigNumber(0),
      weightedApy: new BigNumber(0),
    }
  );
  const totalPositionsValue = hasBorrowPositions
    ? (allPositions?.allPositionsSum ?? new BigNumber(0)).plus(
        borrowTotalSupplied
      )
    : allPositions?.allPositionsSum;
  const averageApyValue = (() => {
    if (!hasBorrowPositions) {
      return averageApy;
    }

    const earnPositionsValue =
      allPositions?.allPositionsSum ?? new BigNumber(0);
    const totalValue = earnPositionsValue.plus(borrowApySummary.totalValue);

    if (!totalValue.gt(0)) {
      return new BigNumber(0);
    }

    const earnWeightedApy =
      averageApy?.times(earnPositionsValue) ?? new BigNumber(0);

    return earnWeightedApy.plus(borrowApySummary.weightedApy).div(totalValue);
  })();
  const availableOrNetWorthValue = hasBorrowPositions
    ? (allPositions?.allPositionsSum ?? new BigNumber(0)).plus(borrowNetWorth)
    : availableBalance;

  const { t } = useTranslation();

  const variant = useWidgetConfig("variant");

  return (
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
          AsyncResult.isInitial(allPositionsResult) || borrowPositionsAreLoading
        }
      />

      <SummaryItem
        type="apy"
        label={t("dashboard.overview.summary.average_apy")}
        value={averageApyValue}
        isLoading={
          AsyncResult.isInitial(averageApyResult) || borrowPositionsAreLoading
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
            ? AsyncResult.isInitial(allPositionsResult) ||
              borrowPositionsAreLoading
            : AsyncResult.isInitial(availableBalanceResult)
        }
      />
    </Box>
  );
};
