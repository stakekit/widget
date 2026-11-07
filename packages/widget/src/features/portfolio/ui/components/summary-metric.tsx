import { useTranslation } from "react-i18next";
import {
  formatPercent,
  formatUsd,
  unavailableFigure,
} from "../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../shared/react/widget-presentation";
import { Metric, Skeleton } from "../../../../ui/index";
import type { SummaryValue } from "../../state/read-models/summary";

/**
 * A Manage summary figure: the label above its neutral value, or a loader. A
 * rate of zero or an unknown figure reads "—"; one unknown because a position
 * source failed says it is partial.
 */
export const SummaryMetric = ({
  label,
  figure,
  isPartial,
  kind,
  size = "default",
}: {
  readonly label: string;
  readonly figure: SummaryValue;
  /** A position source failed, so an unknown figure is a partial one. */
  readonly isPartial: boolean;
  /** A USD amount, or a percent given in whole percents, such as 4.2. */
  readonly kind: "usd" | "percent";
  /** `lead` for the summary's lead figure. */
  readonly size?: "default" | "lead";
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();

  if (figure._tag === "Loading") {
    return (
      <Metric
        label={label}
        size={size}
        value={<Skeleton shape="rect" height="sm" width="half" />}
      />
    );
  }
  if (figure._tag === "Unavailable") {
    return (
      <Metric
        label={label}
        size={size}
        value={unavailableFigure}
        {...(isPartial
          ? { caption: t("dashboard.overview.summary.partial") }
          : {})}
      />
    );
  }

  const { value } = figure;
  if (kind === "usd") {
    return (
      <Metric label={label} size={size} value={formatUsd(value, locale)} />
    );
  }

  return (
    <Metric
      label={label}
      value={
        value.gt(0)
          ? formatPercent(value.dividedBy(100), locale)
          : unavailableFigure
      }
    />
  );
};
