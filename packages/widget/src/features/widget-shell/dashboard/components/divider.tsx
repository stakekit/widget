import { useWidgetConfig } from "../../../../app/config";
import { combineRecipeWithVariant } from "../../../../shared/styles/recipe-variant";
import { Box } from "../../../../shared/ui/primitives/box";
import { tabPageDivider } from "./styles.css";

export const VerticalDivider = () => {
  const variant = useWidgetConfig("variant");

  return (
    <Box
      className={combineRecipeWithVariant({ rec: tabPageDivider, variant })}
    />
  );
};
