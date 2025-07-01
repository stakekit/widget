import { Box } from "../../../components/atoms/box";
import { useSettings } from "../../../providers/settings";
import { combineRecipeWithVariant } from "../../../utils/styles";
import { tabPageDivider } from "./styles.css";

export const VerticalDivider = () => {
  const { variant } = useSettings();

  return (
    <Box
      className={combineRecipeWithVariant({ rec: tabPageDivider, variant })}
    />
  );
};
