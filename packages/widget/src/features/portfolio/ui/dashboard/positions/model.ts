import type { TFunction } from "i18next";
import { toBorrowNetworkToken } from "../../../../../domain/borrow/catalog/token";
import {
  deriveMarketPositionOverview,
  type MarketPosition,
} from "../../../../../domain/borrow/positions/market-position";
import { formatBorrowProviderName } from "../../../../../shared/lib/formatters";
import {
  formatPercent,
  formatTokenAmount,
  formatUsd,
} from "../../../../../shared/lib/number-format";
import { riskBandValueTone } from "../../../../borrow-transaction-flow/index";
import { getBorrowPositionRiskBand } from "../../../state/read-models/positions";

/** A borrow row's risk status: shown in the caution and danger bands only. */
type BorrowRiskStatus = {
  readonly text: string;
  readonly tone: "warning" | "danger";
  readonly icon: "WarningIcon";
};

const getBorrowRiskStatus = (
  position: MarketPosition,
  t: TFunction
): BorrowRiskStatus | null => {
  const band = getBorrowPositionRiskBand(position);
  if (band === "danger") {
    return {
      text: t("dashboard.borrow.risk.alert.danger_title"),
      tone: riskBandValueTone.danger,
      icon: "WarningIcon",
    };
  }
  if (band === "caution") {
    return {
      text: t("dashboard.borrow.risk.alert.caution_title"),
      tone: riskBandValueTone.caution,
      icon: "WarningIcon",
    };
  }
  return null;
};

export const getBorrowMarketPositionListItemModel = ({
  locale,
  position,
  t,
}: {
  readonly locale: string;
  readonly position: MarketPosition;
  readonly t: TFunction;
}) => {
  const debtBalance = position.balances.debt;
  const overview = deriveMarketPositionOverview(position);
  const headerToken = toBorrowNetworkToken({
    network: position.market.network,
    token: overview.headerToken,
  });

  return {
    balanceText: debtBalance
      ? `${formatTokenAmount(debtBalance.balance, locale, "up")} ${debtBalance.tokenSymbol}`
      : formatUsd(position.metrics.totalSuppliedUsd.toString(), locale),
    borrowApy: formatPercent(position.metrics.borrowApy, locale),
    headerToken,
    providerName: formatBorrowProviderName(position.integration.name),
    subValue: debtBalance
      ? `${formatPercent(overview.currentLtv, locale)} ${t(
          "dashboard.borrow.position_details.ltv"
        )} · ${formatUsd(
          debtBalance.balanceUsd.toString(),
          locale
        )} ${t("dashboard.borrow.position_details.debt").toLowerCase()}`
      : t("dashboard.borrow.position_details.supplied"),
    status: getBorrowRiskStatus(position, t),
    title: overview.title,
  };
};
