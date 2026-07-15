import { useWidgetConfig } from "../../../app/config";
import { combineRecipeWithVariant } from "../../../shared/styles/recipe-variant";
import type { BoxProps } from "../../../shared/ui/primitives/box";
import { Box } from "../../../shared/ui/primitives/box";
import { divider } from "./styles.css";

type Props = BoxProps;

export const Divider = (props: Props) => {
  const variant = useWidgetConfig("variant");

  return (
    <Box
      className={combineRecipeWithVariant({ rec: divider, variant })}
      {...props}
    />
  );
};
