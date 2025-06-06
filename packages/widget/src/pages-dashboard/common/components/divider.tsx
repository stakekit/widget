import { Box } from "@sk-widget/components/atoms/box";
import { tabPageDivider } from "@sk-widget/pages-dashboard/common/components/styles.css";
import { useSettings } from "@sk-widget/providers/settings";
import { combineRecipeWithVariant } from "@sk-widget/utils/styles";

export const VerticalDivider = () => {
  const { variant } = useSettings();

  return (
    <Box
      className={combineRecipeWithVariant({ rec: tabPageDivider, variant })}
    />
  );
};
