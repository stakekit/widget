import clsx from "clsx";
import type { ReactNode } from "react";
import { combineRecipeWithVariant } from "../../../styles/recipe-variant";
import { Box, type BoxProps } from "../../primitives/box";
import { pressAnimation } from "../../primitives/button/styles.css";
import { Text } from "../../primitives/typography/text";
import { useWidgetPresentation } from "../../widget-presentation";
import { container, text } from "./styles.css";

type ChipButtonProps = {
  readonly disabled?: boolean;
  readonly label: ReactNode;
  readonly onClick: () => void;
} & Omit<BoxProps, "children" | "onClick">;

/** Compact inline action beside an amount, e.g. Max or Reveal. */
export const ChipButton = ({
  className,
  disabled = false,
  label,
  onClick,
  ...rest
}: ChipButtonProps) => {
  const { variant } = useWidgetPresentation();

  return (
    <Box
      as="button"
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        pressAnimation,
        combineRecipeWithVariant({ rec: container, variant }),
        className
      )}
      {...rest}
    >
      <Text
        variant={{ type: "regular" }}
        className={combineRecipeWithVariant({ rec: text, variant })}
      >
        {label}
      </Text>
    </Box>
  );
};
