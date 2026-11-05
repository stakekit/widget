import type BigNumber from "bignumber.js";
import {
  formatPercent,
  formatUsd,
  unavailableFigure,
} from "../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../shared/react/widget-presentation";
import { Metric, Skeleton } from "../../../../ui/index";

/**
 * A Manage summary figure: the label above its neutral value, or a loader. A
 * rate of zero or none reads "—".
 */
export const SummaryMetric = ({
  label,
  value,
  isLoading,
  kind,
}: {
  readonly label: string;
  readonly value: BigNumber | undefined;
  readonly isLoading: boolean;
  /** A USD amount, or a percent given in whole percents, such as 4.2. */
  readonly kind: "usd" | "percent";
}) => {
  const { locale } = useWidgetPresentation();
  const formatted = (() => {
    if (!value) return unavailableFigure;
    if (kind === "percent") {
      return value.gt(0)
        ? formatPercent(value.dividedBy(100), locale)
        : unavailableFigure;
    }
    return formatUsd(value, locale);
  })();

  return (
    <Metric
      label={label}
      value={
        isLoading ? (
          <Skeleton shape="rect" height="sm" width="half" />
        ) : (
          formatted
        )
      }
    />
  );
};
