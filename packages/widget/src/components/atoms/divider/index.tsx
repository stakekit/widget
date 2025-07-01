import { useSettings } from "../../../providers/settings";
import { combineRecipeWithVariant } from "../../../utils/styles";
import type { BoxProps } from "../box";
import { Box } from "../box";
import { divider } from "./styles.css";

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
