import { combineRecipeWithVariant } from "../../../styles/recipe-variant";
import type { BoxProps } from "../../primitives/box";
import { Box } from "../../primitives/box";
import { useWidgetPresentation } from "../../widget-presentation";
import { divider, verticalDivider } from "./styles.css";

export const Divider = (props: BoxProps) => {
  const { variant } = useWidgetPresentation();

  return (
    <Box
      className={combineRecipeWithVariant({ rec: divider, variant })}
      {...props}
    />
  );
};

export const VerticalDivider = () => {
  const { variant } = useWidgetPresentation();

  return (
    <Box
      className={combineRecipeWithVariant({ rec: verticalDivider, variant })}
    />
  );
};
