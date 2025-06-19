import { divider } from "@sk-widget/components/atoms/divider/styles.css";
import { useSettings } from "@sk-widget/providers/settings";
import { combineRecipeWithVariant } from "@sk-widget/utils/styles";
import type { BoxProps } from "../box";
import { Box } from "../box";

type Props = BoxProps;

export const Divider = (props: Props) => {
  const { variant } = useSettings();

  return (
    <Box
      className={combineRecipeWithVariant({ rec: divider, variant })}
      {...props}
    />
  );
};
