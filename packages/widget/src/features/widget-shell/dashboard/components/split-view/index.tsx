import clsx from "clsx";
import { type ReactNode, useState } from "react";
import { VerticalDivider } from "../../../../../shared/ui/components/divider";
import { Box } from "../../../../../shared/ui/primitives/box";
import { CaretLeftIcon } from "../../../../../shared/ui/primitives/icons/caret-left";
import { useSplitCollapsed } from "../use-split-collapsed";
import * as styles from "./styles.css";

type Side = "primary" | "secondary";

type SplitViewProps = {
  primary: ReactNode;
  secondary: ReactNode;
  primaryBarLabel: string;
  secondaryBarLabel: string;
};

const resolvePanelClass = ({
  activeClass,
  isCollapsed,
  isVisible,
}: {
  activeClass: string;
  isCollapsed: boolean;
  isVisible: boolean;
}) => {
  if (!isCollapsed) return styles.panelWrapContents;
  if (isVisible) return activeClass;
  return styles.panelWrapHidden;
};

export const SplitView = ({
  primary,
  secondary,
  primaryBarLabel,
  secondaryBarLabel,
}: SplitViewProps) => {
  const isCollapsed = useSplitCollapsed();
  const [activeSide, setActiveSide] = useState<Side>("primary");

  if (!primary || !secondary) {
    return <Box className={styles.container}>{primary || secondary}</Box>;
  }

  const showPrimary = !isCollapsed || activeSide === "primary";
  const showSecondary = !isCollapsed || activeSide === "secondary";
  const revealLabel =
    activeSide === "primary" ? secondaryBarLabel : primaryBarLabel;

  const primaryClass = resolvePanelClass({
    activeClass: styles.panelWrapActiveFromLeft,
    isCollapsed,
    isVisible: showPrimary,
  });
  const secondaryClass = resolvePanelClass({
    activeClass: styles.panelWrapActiveFromRight,
    isCollapsed,
    isVisible: showSecondary,
  });

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
