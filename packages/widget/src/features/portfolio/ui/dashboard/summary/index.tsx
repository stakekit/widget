import BigNumber from "bignumber.js";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../../app/config/use-widget-config";
import { combineRecipeWithVariant } from "../../../../../shared/styles/recipe-variant";
import { Box } from "../../../../../shared/ui/primitives/box";
import {
  useBorrowFeatureEnabled,
  useBorrowPositions,
} from "../../../../borrow/state";
import { useSummary } from "../../../react/use-summary";
import { SummaryItem } from "../../components/summary-item";
import { summaryContainer } from "../../components/summary-item/index.css";

export const Summary = () => {
  const { allPositionsQuery, averageApyQuery, availableBalanceSumQuery } =
    useSummary();
  const borrowFeatureEnabled = useBorrowFeatureEnabled();
  const borrowPositions = useBorrowPositions({ enabled: borrowFeatureEnabled });
  const borrowPositionItems = AsyncResult.getOrElse(
    borrowPositions.positionsResult,
    () => []
  );
  const borrowPositionsAreLoading =
    borrowFeatureEnabled &&
    borrowPositions.walletBridge.status === "connected" &&
    (AsyncResult.isInitial(borrowPositions.positionsResult) ||
      AsyncResult.isWaiting(borrowPositions.positionsResult));
  const hasBorrowPositions =
    borrowFeatureEnabled && borrowPositionItems.length > 0;
  const borrowTotalSupplied = borrowPositionItems.reduce(
    (acc, position) => acc.plus(position.getTotalSuppliedUsd()),
    new BigNumber(0)
  );
  const borrowNetWorth = borrowPositionItems.reduce(
    (acc, position) => acc.plus(position.getNetWorthUsd()),
    new BigNumber(0)
  );
  const borrowApySummary = borrowPositionItems.reduce(
    (acc, position) => {
      const netWorth = position.getNetWorthUsd();

      if (netWorth <= 0) {
        return acc;
      }

      return {
        totalValue: acc.totalValue.plus(netWorth),
        weightedApy: acc.weightedApy.plus(
          position.getNetApy() * 100 * netWorth
        ),
      };
    },
    {
      totalValue: new BigNumber(0),
      weightedApy: new BigNumber(0),
    }
  );
  const totalPositionsValue = hasBorrowPositions
    ? (allPositionsQuery.data?.allPositionsSum ?? new BigNumber(0)).plus(
        borrowTotalSupplied
      )
    : allPositionsQuery.data?.allPositionsSum;
  const averageApyValue = (() => {
    if (!hasBorrowPositions) {
      return averageApyQuery.data;
    }

    const earnPositionsValue =
      allPositionsQuery.data?.allPositionsSum ?? new BigNumber(0);
    const totalValue = earnPositionsValue.plus(borrowApySummary.totalValue);

    if (!totalValue.gt(0)) {
      return new BigNumber(0);
    }

    const earnWeightedApy =
      averageApyQuery.data?.times(earnPositionsValue) ?? new BigNumber(0);

    return earnWeightedApy.plus(borrowApySummary.weightedApy).div(totalValue);
  })();
  const availableOrNetWorthValue = hasBorrowPositions
    ? (allPositionsQuery.data?.allPositionsSum ?? new BigNumber(0)).plus(
        borrowNetWorth
      )
    : availableBalanceSumQuery.data;

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
        isLoading={allPositionsQuery.isLoading || borrowPositionsAreLoading}
      />

      <SummaryItem
        type="apy"
        label={t("dashboard.overview.summary.average_apy")}
        value={averageApyValue}
        isLoading={averageApyQuery.isLoading || borrowPositionsAreLoading}
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
            ? allPositionsQuery.isLoading || borrowPositionsAreLoading
            : availableBalanceSumQuery.isLoading
        }
      />
    </Box>
  );
};
