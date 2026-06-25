import clsx from "clsx";
import { type ReactNode, useState } from "react";
import { Box } from "../../../../components/atoms/box";
import { CaretLeftIcon } from "../../../../components/atoms/icons/caret-left";
import { useMediaQuery } from "../../../../hooks/use-media-query";
import { splitCollapsedMediaQuery } from "../../../../styles/tokens/breakpoints";
import { VerticalDivider } from "../divider";
import * as styles from "./styles.css";

type Side = "primary" | "secondary";

type SplitViewProps = {
  primary: ReactNode;
  secondary: ReactNode;
  primaryBarLabel: string;
  secondaryBarLabel: string;
};

export const SplitView = ({
  primary,
  secondary,
  primaryBarLabel,
  secondaryBarLabel,
}: SplitViewProps) => {
  const isCollapsed = useMediaQuery(splitCollapsedMediaQuery);
  const [activeSide, setActiveSide] = useState<Side>("primary");

  if (!primary || !secondary) {
    return <Box className={styles.container}>{primary || secondary}</Box>;
  }

  const showPrimary = !isCollapsed || activeSide === "primary";
  const showSecondary = !isCollapsed || activeSide === "secondary";
  const revealLabel =
    activeSide === "primary" ? secondaryBarLabel : primaryBarLabel;

  const primaryClass = !isCollapsed
    ? styles.panelWrapContents
    : showPrimary
      ? styles.panelWrapActiveFromLeft
      : styles.panelWrapHidden;

  const secondaryClass = !isCollapsed
    ? styles.panelWrapContents
    : showSecondary
      ? styles.panelWrapActiveFromRight
      : styles.panelWrapHidden;

  return (
    <Box className={styles.container}>
      <Box className={primaryClass}>{primary}</Box>

      {isCollapsed ? (
        <Box
          as="button"
          type="button"
          aria-label={revealLabel}
          className={clsx(
            styles.bar,
            activeSide === "primary"
              ? styles.barBleedRight
              : styles.barBleedLeft
          )}
          onClick={() =>
            setActiveSide((side) =>
              side === "primary" ? "secondary" : "primary"
            )
          }
        >
          <Box
            as="span"
            className={clsx(
              styles.barIcon,
              activeSide === "secondary" && styles.barIconFlipped
            )}
          >
            <CaretLeftIcon />
          </Box>

          <Box as="span" className={styles.barLabel}>
            {revealLabel}
          </Box>
        </Box>
      ) : (
        <VerticalDivider />
      )}

      <Box className={secondaryClass}>{secondary}</Box>
    </Box>
  );
};
