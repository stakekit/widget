import clsx from "clsx";
import type { ReactNode } from "react";
import { Box } from "../../primitives/box";
import { Text } from "../../primitives/typography/text";
import * as styles from "./styles.css";

type PositionMetricTone = "action" | "claim" | "default";

export type PositionMetricCard = Readonly<{
  readonly id: string;
  readonly label: ReactNode;
  readonly subValue?: ReactNode;
  readonly tone?: PositionMetricTone;
  readonly value: ReactNode;
  readonly valueClassName?: string;
}>;

const renderMetricSubValue = (subValue: ReactNode) => {
  if (!subValue) return null;
  if (typeof subValue !== "string") return subValue;

  return (
    <Text
      className={styles.metricSubValueText}
      variant={{ type: "muted", weight: "normal" }}
    >
      {subValue}
    </Text>
  );
};

export const PositionDetailsPane = ({
  children,
  kind,
}: {
  readonly children: ReactNode;
  readonly kind: "actions" | "info";
}) => (
  <Box
    className={styles.pane({ kind })}
    display="flex"
    flexDirection="column"
    gap="4"
    width="0"
    {...(kind === "actions" ? { flex: 1 } : {})}
  >
    {children}
  </Box>
);

export const PositionDetailsBreadcrumb = ({
  backButton,
  positionName,
  rootLabel,
}: {
  readonly backButton: ReactNode;
  readonly positionName: string | null;
  readonly rootLabel: ReactNode;
}) => (
  <Box className={styles.breadcrumb}>
    {backButton}
    <Text variant={{ weight: "bold" }}>{rootLabel}</Text>
    {positionName ? (
      <Text
        className={styles.breadcrumbName}
        variant={{ type: "muted", weight: "normal" }}
      >
        {`/ ${positionName}`}
      </Text>
    ) : null}
  </Box>
);

export const PositionDetailsScrollArea = ({
  children,
}: {
  readonly children: ReactNode;
}) => (
  <Box
    className={styles.scrollArea}
    display="flex"
    flexDirection="column"
    gap="4"
  >
    {children}
  </Box>
);

export const PositionMetricCards = ({
  cards,
}: {
  readonly cards: ReadonlyArray<PositionMetricCard>;
}) => (
  <Box className={styles.metricGrid}>
    {cards.map((card) => {
      const tone = card.tone ?? "default";

      return (
        <Box
          className={styles.metricCard({ tone })}
          display="flex"
          flexDirection="column"
          gap="1"
          key={card.id}
        >
          {typeof card.label === "string" ? (
            <Text
              className={styles.metricLabelText}
              variant={{ type: "muted", weight: "normal" }}
            >
              {card.label}
            </Text>
          ) : (
            card.label
          )}

          {typeof card.value === "string" ? (
            <Text
              className={clsx(
                styles.metricValueText({ tone }),
                card.valueClassName
              )}
              variant={{ weight: "bold" }}
            >
              {card.value}
            </Text>
          ) : (
            card.value
          )}

          {renderMetricSubValue(card.subValue)}
        </Box>
      );
    })}
  </Box>
);

export const PositionBreakdownRows = ({
  rows,
}: {
  readonly rows: ReadonlyArray<{
    readonly id: string;
    readonly label: string;
    readonly subValue?: string;
    readonly value: string;
  }>;
}) => (
  <Box display="flex" flexDirection="column">
    {rows.map((row) => (
      <Box className={styles.breakdownRow} key={row.id}>
        <Text variant={{ type: "muted", weight: "normal" }}>{row.label}</Text>

        <Box className={styles.breakdownAmounts}>
          <Text className={styles.breakdownValue}>{row.value}</Text>
          {row.subValue ? (
            <Text
              className={styles.breakdownSubValue}
              variant={{ type: "muted", weight: "normal" }}
            >
              {row.subValue}
            </Text>
          ) : null}
        </Box>
      </Box>
    ))}
  </Box>
);
