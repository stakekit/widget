import type { BoxProps } from "../../primitives/box";
import { Box } from "../../primitives/box";
import { divider, verticalDivider } from "./styles.css";

export const Divider = (props: BoxProps) => (
  <Box className={divider} {...props} />
);

export const VerticalDivider = () => <Box className={verticalDivider} />;
